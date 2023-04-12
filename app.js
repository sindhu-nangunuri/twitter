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
  response.send(latestDbTweets);
});

// API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getLoggedInUserId = `SELECT user_id
                                  FROM user
                                  WHERE username = '${username}'; `;
  const dbUserId = await db.get(getLoggedInUserId);
  console.log(dbUserId);
  const getFollowerNamesQuery = `SELECT user.name
                                    FROM follower 
                                    INNER JOIN user
                                    ON user.user_id = follower.following_user_id
                                    WHERE follower.follower_user_id = ${dbUserId.user_id};`;
  const followerNames = await db.all(getFollowerNamesQuery);
  console.log(followerNames);
  response.send(followerNames);
});

// API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getLoggedInUserId = `SELECT user_id
                                  FROM user
                                  WHERE username = '${username}'; `;
  const dbUserId = await db.get(getLoggedInUserId);
  const getFollowingNamesQuery = `SELECT user.name
                                     FROM follower
                                     INNER JOIN user
                                     ON user.user_id = follower.follower_user_id
                                     WHERE follower.following_user_id = ${dbUserId.user_id};`;
  const followingNames = await db.all(getFollowingNamesQuery);
  console.log(followingNames);
  response.send(followingNames);
});

// API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  const getLoggedInUserId = `SELECT user_id
                                  FROM user
                                  WHERE username = '${username}'; `;
  const dbUserId = await db.get(getLoggedInUserId);
  console.log(dbUserId);
  const tweetsQuery = `SELECT * FROM 
                         tweet
                         WHERE tweet_id = ${tweetId};`;
  const tweetResult = await db.get(tweetsQuery);
  console.log(tweetResult);
  const userFollowersQuery = `SELECT *  FROM 
                                 follower INNER JOIN user ON user.user_id = follower.following_user_id
    
                                 WHERE follower.follower_user_id = ${dbUserId.user_id};`;
  const userFollowers = await db.all(userFollowersQuery);
  if (
    userFollowers.some((item) => item.following_user_id === tweetResult.user_id)
  ) {
    const getTweetsQuery = `SELECT * FROM
                              tweet INNER JOIN reply ON tweet.user_id = reply.user_id
                              INNER JOIN like ON tweet.tweet_id = like.user_id
                              WHERE tweet.tweet_id = ${tweetId};`;
    const result = await db.get(getTweetsQuery);
    console.log(result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
  console.log(userFollowers);
});

// API 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getLoggedInUserId = `SELECT user_id
                                  FROM user
                                  WHERE username = '${username}'; `;
  const dbUserId = await db.get(getLoggedInUserId);
  console.log(dbUserId);
  const getUserTweets = `SELECT tweet.tweet, COUNT(like_id) AS likes, COUNT(reply) AS replies, date_time AS dateTime
                           FROM (tweet 
                           INNER JOIN reply ON tweet.tweet_id = reply.tweet_id) AS T 
                           INNER JOIN like ON T.tweet_id = like.tweet_id
                           WHERE tweet.user_id = ${dbUserId.user_id}
                           GROUP BY 
                           tweet;`;
  const tweetResults = await db.all(getUserTweets);
  console.log(tweetResults);
  response.send(tweetResults);
});

// API 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const tweetDetails = request.body;
  const { tweet } = tweetDetails;
  let { username } = request;
  const getLoggedInUserId = `SELECT user_id
                                  FROM user
                                  WHERE username = '${username}'; `;
  const dbUserId = await db.get(getLoggedInUserId);
  console.log(dbUserId);
  const addTweetQuery = `INSERT INTO
                            tweet(tweet)
                            VALUES('${tweet}');`;
  const addedTweet = await db.run(addTweetQuery);
  response.send("Created a Tweet");
});

// API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getLoggedInUserId = `SELECT user_id
                                  FROM user
                                  WHERE username = '${username}'; `;
    const dbUserId = await db.get(getLoggedInUserId);
    console.log(dbUserId);
    const selectedTweetToDeleteQuery = `SELECT * FROM tweet
                                      WHERE 
                                      tweet_id = ${tweetId};`;
    const selectedTweetToDelete = await db.get(selectedTweetToDeleteQuery);
    console.log(selectedTweetToDelete);
    if (selectedTweetToDelete.user_id === dbUserId.user_id) {
      const deleteTweetQuery = `DELETE FROM 
                                tweet
                                WHERE tweet_id = ${selectedTweetToDelete.tweet_id};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
module.exports = app;
