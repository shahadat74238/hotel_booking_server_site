const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
var cron = require("node-cron");
var cookieParser = require("cookie-parser");
const port = process.env.PORT || 3001;

// ------------ Middleware --------------------
app.use(express.json());
app.use(cors({
  origin: [
    "https://hotel-a678c.web.app",
    "https://hotel-a678c.firebaseapp.com/"
],
  credentials: true,
}))
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cxghft2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//  -------------- verify token -----------

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const roomsCollection = client.db("fiveStar_hotel").collection("rooms");
    const bookingCollection = client
      .db("fiveStar_hotel")
      .collection("bookings");
    const commentsCollection = client
      .db("fiveStar_hotel")
      .collection("comments");
    const featureCollection = client
      .db("fiveStar_hotel")
      .collection("featureRooms");

    // ---------------- jwt token ----------------
    app.post("/api/v1/token", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.SECRET, { expiresIn: "1h" });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/api/v1/logout", async (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // ------------- Get rooms ----------------------
    app.get("/api/v1/rooms", async (req, res) => {
      const price = req.query.price;
      const result = await roomsCollection.find().toArray();
      if (price === "highToLow") {
        result.sort((roomA, roomB) => roomB.price - roomA.price);
      } else if (price === "lowToHigh") {
        result.sort((roomA, roomB) => roomA.price - roomB.price);
      } else if (price === "a-z") {
        result.sort((a, b) => a.roomTitle.localeCompare(b.roomTitle));
      }
      res.send(result);
    });

    app.get("/api/v1/rooms/:roomId", async (req, res) => {
      const id = req.params.roomId;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });

    // -------------- Features Rooms --------------
    app.get('/api/v1/features/rooms', async (req, res) => {
      const result = await featureCollection.find().toArray()
      res.send(result);
    })

    // --------------- Comments --------------------

    app.post("/api/v1/comments", async (req, res) => {
      const comment = req.body;
      console.log(comment);
      const result = await commentsCollection.insertOne(comment);
      res.send(result);
    });

    app.get("/api/v1/comments", async (req, res) => {
      const id = req.query.roomId;
      const query = { roomId: id };
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    });

    // --------------- Booking ---------------

    app.post("/api/v1/booking", async (req, res) => {
      const booking = req.body;
      const { roomId, checkOut } = booking;
      const query = { _id: new ObjectId(roomId) };
      console.log(roomId);
      const result = await bookingCollection.insertOne(booking);
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          isBooked: true,
          endDate: checkOut,
        },
      };
      await roomsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.get("/api/v1/booking", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/api/v1/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const findBooking = await bookingCollection.findOne(query);
      if (findBooking) {
        const query2 = { _id: new ObjectId(findBooking.roomId) };
        const result = await bookingCollection.deleteOne(query);
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            isBooked: false,
            endDate: "",
          },
        };
        await roomsCollection.updateOne(query2, updateDoc, options);
        return res.send(result);
      }
      res.send("Room Not Found !");
    });

    app.put("/api/v1/booking", async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateBooking = req.body;
      const updateDoc = {
        $set: {
          checkOut: updateBooking.newDate,
        },
      };
      const result = await bookingCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    // ---------------

    cron.schedule(" 59 23 * * *", async () => {
      const ab = await roomsCollection.find().toArray();
      await Promise.all(
        ab.map(async (a) => {
          if (a.isBooked) {
            const query2 = { _id: new ObjectId(a._id) };
            console.log(query2);
            const options = { upsert: true };
            const updateDoc = {
              $set: {
                isBooked: false,
                endDate: "",
              },
            };
            await bookingCollection.deleteMany();

            const ud = await roomsCollection.updateOne(
              query2,
              updateDoc,
              options
            );
            console.log();
          }
        })
      );
      console.log("running a task every minute");
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Five Star Hotel Backend is Running !");
});

app.listen(port, () => {
  console.log(`Example app listening port: ${port}`);
});
