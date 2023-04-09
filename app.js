const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};

initializeDBAndServer();

// create User API

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
                    SELECT 
                        *
                    FROM
                        user
                    WHERE 
                        username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    const createUserQuery = `
                    INSERT INTO
                        user(name, username, password, gender)
                    VALUES('${name}', '${username}', '${hashedPassword}', '${gender}');`;
    lengthOfPassword = password.length;
    if (lengthOfPassword < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

// Login API 2

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// User Login API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
                    SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      console.log(payload.username);
      const jwtToken = jwt.sign(payload, "asdfghjkl");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getLoggedInUserId = `SELECT user_id 
                                FROM user 
                                WHERE username = '${username}';`;
  const dbUserId = await db.get(getLoggedInUserId);
  console.log(dbUserId);
  const getLatestTweetsQuery = `SELECT user.username, tweet.tweet, tweet.date_time AS dateTime
                                    FROM follower
                                    INNER JOIN tweet
                                    ON follower.following_user_id = tweet.user_id
                                    INNER JOIN user
                                    ON tweet.user_id = user.user_id
                                    WHERE 
                                    follower.follower_user_id = ${dbUserId.user_id}
                                    ORDER BY 
                                    tweet.date_time DESC
                                    LIMIT 4;`;
  const latestDbTweets = await db.all(getLatestTweetsQuery);
  console.log(latestDbTweets);
});

module.exports = app;
