const express = require('express');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 8080; // default port 8080

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  keys: ['key0'],

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));
app.set('view engine', 'ejs');

// Example URL Database
const urlDatabase = {
  b2xVn2: {
    longUrl: 'http://www.lighthouselabs.ca',
    userID: 'SteveJackson'
  },
  '9sm5xK': {
    longUrl: 'http://www.google.com',
    userID: 'BobJackson'
  },
  b2xVYY: {
    longUrl: 'http://www.yahoo.ca',
    userID: 'SteveJackson'
  }
};

const users = {
  BobJackson: {
    id: 'BobJackson',
    email: 'bob@example.com',
    password: 'b123'
  },
  SteveJackson: {
    id: 'SteveJackson',
    email: 'steve@example.com',
    password: 's123'
  }
};

app.get('/', (req, res) => {
  if (req.session.user_id) {
    res.redirect(`/urls`);
  } else {
    res.redirect(`/login`);
  }
});


// Sends the URL database and username to the index page
app.get('/urls', (req, res) => {
  const userURLS = userDB(req.session.user_id);
  const templateVars = {
    urls: userURLS,
    user: users[req.session.user_id]
  };
  res.render('urls_index', templateVars);
});

// For adding a new URL
app.get('/urls/new', (req, res) => {
  const templateVars = {
    urls: urlDatabase,
    user: users[req.session.user_id]
  };
  if (req.session.user_id) {
    res.render('urls_new', templateVars);
  } else {
    res.redirect(`/login`);
  }
});

// shows the specified URL short and long and offers option to update if desired.
app.get('/urls/:id', (req, res) => {
  const userURLS = userDB(req.session.user_id);
  if (!urlDatabase[req.params.id]) {
    res.status(400).send({ Error: 'URL does not exist' });
  } else if (!req.session.user_id) {
    const templateVars = {
      user: users[req.session.user_id]
    };
    res.render('urls_show', templateVars);
  } else if (req.session.user_id && userURLS[req.params.id]) {
    const templateVars = {
      shortURL: req.params.id,
      longURL: userURLS[req.params.id],
      user: users[req.session.user_id]
    };
    res.render('urls_show', templateVars);
  } else {
    res.status(400).send({ Error: 'URL does not belong to you' });
  }
});

// Adds new url, assigns random id/short url and adds it to the database. Otherwise fires error.
app.post('/urls', (req, res) => {
  const httpCheck = req.body.longURL.slice(0, 7);
  const templateVars = {
    user: users[req.session.user_id]
  };
  if (httpCheck === 'http://') {
    const id = generateRandomString();
    urlDatabase[id] = {
      longUrl: req.body.longURL,
      userID: req.session.user_id
    };
    res.redirect(`/urls/${id}`);
  } else {
    res.render('urls_error', templateVars);
  }
});

// redirect platform for shortened URLS
app.get('/u/:shortURL', (req, res) => {
  if (urlDatabase[req.params.shortURL]) {
    res.redirect(urlDatabase[req.params.shortURL]['longUrl']);
  } else {
    res.status(400).send({ Error: 'URL does not exist' });
  }
});

// when a request to delete a url this is activated.
app.post('/urls/:id/delete', (req, res) => {
  const shortURL = req.params.id;
  if (req.session.user_id === urlDatabase[shortURL].userID) {
    delete urlDatabase[shortURL];
    res.redirect(`/urls`);
  } else {
    res.redirect(`/urls`);
  }
});

// when a URL is updated/changed this is activated.
app.post('/urls/:id', (req, res) => {
  const newURL = req.body.updatedURL;
  const shortURL = req.params.id;
  const httpCheck = newURL.slice(0, 7);
  if (req.session.user_id === urlDatabase[shortURL].userID) {
    if (httpCheck === 'http://') {
      const id = req.params.id;
      urlDatabase[id].longUrl = newURL;
      res.redirect(`/urls`);
    } else {
      res.status(400).send({ Error: 'URL should start with http://  try again' });
    }
  } else {
    res.status(400).send({ Error: 'Not authorized to delete this URL' });
  }
});

// request which returns the registration page
app.get('/register', (req, res) => {
  if (users[req.session.user_id]) {
    res.redirect(`/urls`);
  } else {
    const templateVars = {
      urls: urlDatabase,
      user: users[req.session.user_id]
    };
    res.render('register', templateVars);
  }
});

// User submits a request to register a new user
app.post('/register', (req, res) => {
  let exists = userExists(req.body.email);
  if (!req.body.email || !req.body.password) {
    res.status(400).send({ Error: 'Username/Password fields cannot be empty' });
  } else if (exists) {
    res.status(400).send({ Error: 'An account exists for this username. Try Registering Again' });
  } else {
    const id = generateRandomString();
    const password = req.body.password;
    const hashedPassword = bcrypt.hashSync(password, 10);
    users[id] = {
      id: id,
      email: req.body.email,
      password: hashedPassword
    };
    req.session.user_id = id;
    res.redirect(`/urls`);
  }
});

// user logs in and cookie gets set. -------no longer in use
app.get('/login', (req, res) => {
  if (users[req.session.user_id]) {
    res.redirect(`/urls`);
  } else {
    res.render('login');
  }
});

app.post('/login', (req, res) => {
  const exists = userExists(req.body.email);
  const userVerified = userId(exists);
  const templateVars = {
    urls: urlDatabase,
    user: users[userVerified]
  };
  if (exists) {
    if (bcrypt.compareSync(req.body.password, users[userVerified].password)) {
      req.session.user_id = userVerified;
      res.redirect(`/urls`);
    } else {
      res.status(400).send({ Error: 'Password incorrect' });
    }
  } else {
    res.status(400).send({ Error: 'Email is not recoqnized' });
  }
});

// receiving a request to log out. Clears cookies then sends them back to urls page.
app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect(`/urls`);
});

// Starts the server and listens for requests on specified port.
app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});

// generates a random string for Short URL.
function generateRandomString () {
  const charOptions = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomString = '';
  for (let i = 0; i < 6; i += 1) {
    randomString += charOptions[Math.floor(Math.random() * charOptions.length)];
  }
  return randomString;
}

function userExists (reqEmail) {
  let user = '';
  Object.keys(users).filter(function (key) {
    if (users[key].email === reqEmail) {
      user = users[key].email;
      return users[key].email;
    }
  });
  return user;
}

function userId (reqEmail) {
  let user = '';
  Object.keys(users).filter(function (key) {
    if (users[key].email === reqEmail) {
      user = users[key].id;
      return users[key].id;
    }
  });
  return user;
}

function userDB (ident) {
  const userURLS = {};
  const exists = users[ident];
  if (users[ident]) {
    Object.keys(urlDatabase).filter(function (key) {
      if (urlDatabase[key].userID === ident) {
        userURLS[key] = urlDatabase[key];
      }
    });
  return userURLS;
  }
}