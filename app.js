const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();

app.use(express.json());

let db = null;
const initializer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3010, () =>
      console.log("Sever is running at http://localhost:3010/")
    );
  } catch (e) {
    console.log(`DB error${e.message}`);
    process.exit(1);
  }
};
initializer();

const convertStets = (items) => {
  return {
    stateId: items.state_id,
    stateName: items.state_name,
    population: items.population,
  };
};

////  Authentication

function authenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
     response.status(401);
     response.send(`Invalid JWT Token`); 
  }else {
   jwt.verify(jwtToken, "Secret token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`); // Scenario 1
      } else {
        //request.username = payload.username;
        next(); //Scenario 2
      }
    });
  } 
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userResponse = await db.get(userQuery);
  if (userResponse === undefined) {
    response.status(400);
    response.rend("Invalid user");
  }
  else {
    const passwordMatch = await bcrypt.compare(password, userResponse.password);
    if (passwordMatch) {
      let payload = { username: username };
      let jwtToken = jwt.sign(payload, "Secret token");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});


/// API 2 GET /states/

app.get("/states/", authenticationToken, async (request, response) => {
  const stateQuery = `SELECT * FROM state`;
  const allStates = await db.all(stateQuery);
  response.send(allStates.map((states) => convertStets(states)));
});

/// API 3 get /states/:stateId/

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT * FROM state WHERE state_id= '${stateId}'`;
  const allStates = await db.get(stateQuery);
  response.send(convertStets(allStates));
});

/// API 4 post

//districtName, stateId, cases, cured, active, deaths;

app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createQuery = `INSERT INTO 
    district (district_name,state_id, cases,cured, active,deaths) 
    VALUES( '${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`;
  await db.run(createQuery);
  response.send(`District Successfully Added`);
});

/////    api update /districts/:districtId/
const convertDist = (item) => {
  return {
    districtId: item.district_id,
    districtName: item.districtName,
    stateId: item.stateId,
    cases: item.cases,
    cured: item.cured,
    active: item.active,
    deaths: item.deaths,
  };
};
// app.get("/districts/", async (request, response) => {
//   //const { districtId } = request.params;
//   const districtQuery = `SELECT * FROM district`;
//   const allDist = await db.all(districtQuery);
//   response.send(allDist);
// });

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `SELECT * FROM district 
  WHERE district_id= '${districtId}'`;
    const allDist = await db.get(districtQuery);
    response.send(convertDist(allDist));
  }
);

//// API delete district

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `DELETE FROM district 
  WHERE district_id= '${districtId}'`;
    const allDist = await db.run(districtQuery);
    response.send("District Removed");
  }
);

/// API UPDATE DISTRICT

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `UPDATE district 
  SET district_name ='${districtName}', 
  state_id =${stateId}, 
  cases=${cases}, 
  cured=${cured}, 
  active=${active}, 
  deaths=${deaths}
  WHERE district_id= '${districtId}'`;
    const allDist = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);


////8 API get /states/:stateId/stats/

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
