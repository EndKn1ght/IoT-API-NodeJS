const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "farm_monitoting_agrosense",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

app.get("/api/getdata", (req, res) => {
  db.query("SELECT * FROM sensors", (err, results) => {
    if (err) {
      console.error("Error querying data from MySQL:", err);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    // Send the retrieved data in the response
    res.json({ data: results });
  });
});

app.get("/api/getweek", (req, res) => {
  const { year, month } = req.query;

  if (!year || !month) {
    return res
      .status(400)
      .json({ error: "Year and month are required parameters" });
  }

  db.query(
    "SELECT DAYOFMONTH(date) AS day_of_month, DATE_FORMAT(date, '%Y-%m-%d') AS formatted_date, MONTHNAME(date) AS month_name, AVG(temperature) AS mean_temperature, AVG(moisture) AS mean_moisture, AVG(humidity) AS mean_humidity, AVG(soil_temperature) AS mean_soil_temperature FROM sensors WHERE YEAR(date) = ? AND MONTH(date) = ? GROUP BY day_of_month, formatted_date, month_name ORDER BY formatted_date",
    [year, month],
    (err, results) => {
      if (err) {
        console.error("Error querying data from MySQL:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      const monthData = { [month]: results }; // Use the numeric month as the key
      res.json(monthData);
    }
  );
});

app.get("/api/getmonth", (req, res) => {
  // Extract month and year from query parameters
  const { month, year } = req.query;

  // Validate input
  if (!month || !year) {
    res
      .status(400)
      .json({ error: "Month and year are required query parameters." });
    return;
  }

  // Select the month, week number, starting date of the week, and the mean values for each parameter
  db.query(
    "SELECT WEEK(date) AS week_number, MIN(DATE(date)) AS start_date, AVG(temperature) AS mean_temperature, AVG(moisture) AS mean_moisture, AVG(humidity) AS mean_humidity, AVG(soil_temperature) AS mean_soil_temperature FROM sensors WHERE MONTH(date) = ? AND YEAR(date) = ? GROUP BY week_number ORDER BY start_date",
    [month, year],
    (err, results) => {
      if (err) {
        console.error("Error querying data from MySQL:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      // Organize the results by week and filter by year
      const organizedData = results
        .filter((result) => new Date(result.start_date).getFullYear() == year)
        .map((result) => ({
          week_number: result.week_number,
          start_date: new Date(result.start_date).toLocaleDateString(),
          mean_temperature: result.mean_temperature,
          mean_moisture: result.mean_moisture,
          mean_humidity: result.mean_humidity,
          mean_soil_temperature: result.mean_soil_temperature,
        }));

      // Sort the data by date within each week
      organizedData.sort(
        (a, b) => new Date(a.start_date) - new Date(b.start_date)
      );

      // Get the name of the month
      const monthName = new Date(`${year}-${month}-01`).toLocaleString(
        "default",
        { month: "long" }
      );

      // Send the organized data in the response with the month name as the key
      res.json({ [monthName]: organizedData });
    }
  );
});

app.post("/api/postdata", (req, res) => {
  const data = req.body;

  db.query(
    "INSERT INTO sensors (date, temperature, moisture, relay, humidity, soil_temperature) VALUES (NOW(), ?, ?, ?, ?, ?)",
    [
      data.temperature,
      data.moisture,
      data.relay,
      data.humidity,
      data.soil_temperature,
    ],
    (err, results) => {
      if (err) {
        console.error("Error inserting data into MySQL:", err);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      res.json({ receivedData: data, insertedId: results.insertId });
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
