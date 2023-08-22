const express = require('express');
const cors = require('cors');
const app = express();
const Task = require('./src/task');
const User = require('./src/user');
const mongoose = require('mongoose');
const Account = require('./src/accounts')
const bcrypt = require('bcrypt');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const MongoStore = require('connect-mongodb-session')(session);
require('dotenv').config({ path: "./.env" });

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

const store = new MongoStore({
  uri: process.env.MONGO_URI,
  collection: 'sessions', // The name of the collection where the sessions will be stored
  mongooseConnection: mongoose.connection,
  autoRemove: 'interval',
  autoRemoveInterval: 60, // Remove expired sessions every 1 minute
});

app.use(cors({
  origin: "http://localhost:3001",
  credentials: true,
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"],
}));

app.use(
  session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.post('/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy((err) => {
      if (err) {
        console.log('Error: Failed to destroy the session during logout.', err);
        res.status(500).json({ error: err.message });
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logout successful' });
    });
  });
});

app.post('/api/accounts', ensureAuthenticated, async (req, res) => {
  try {
    const newAccount = req.body;
    const account = new Account(newAccount);
    await account.save();
    res.status(201).json(account);
  } catch (error) {
    console.error('Error adding account:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts', ensureAuthenticated, async (req, res) => {
  try {
    const accounts = await Account.find();
    res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


passport.use(
  new LocalStrategy(
    { usernameField: 'username', passReqToCallback: true },
    async (req, username, password, done) => {
      try {
        const user = await User.findOne({ username });
        if (!user) {
          console.log(`User ${username} not found`);
          return done(null, false, { message: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          console.log(`Password mismatch for user ${username}`);
          return done(null, false, { message: 'Invalid username or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err);
    });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    return res.status(401).json({ error: 'User is not authenticated' });
  }
}

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(401).json({ error: info.message });
    }
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      return res.status(200).json({ message: 'Login successful', user: user });
    });
  })(req, res, next);
});

app.get('/check-auth', (req, res) => {
  if (req.isAuthenticated()) {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
    res.status(200).json({ user: req.user, isAuthenticated: true });
  } else {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
    res.status(200).json({ user: null, isAuthenticated: false });
  }
});

app.get('/tasks', ensureAuthenticated, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user._id }).lean();
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/tasks', ensureAuthenticated, async (req, res) => {
  try {
    const { shortDescription, longDescription, deadline, priority, assignedBy } = req.body;
    const { _id: userId, username: userName } = req.user; // Destructure _id and username

    const task = new Task({
      userId,
      userName,
      shortDescription,
      longDescription,
      deadline,
      priority,
      assignedBy,
    });

    await task.save();
    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/tasks/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { shortDescription, longDescription, deadline, priority, assignedBy } = req.body;
    
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        shortDescription,
        longDescription,
        deadline,
        priority,
        assignedBy,
      },
      { new: true } // Return the updated task
    );

    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


app.delete('/tasks/:id', ensureAuthenticated, async (req, res) => {
  try {
    await Task.findByIdAndRemove(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', ensureAuthenticated, async (req, res) => {
  try {
    const deletedAccount = await Account.findByIdAndRemove(req.params.id);
    if (!deletedAccount) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});



const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
