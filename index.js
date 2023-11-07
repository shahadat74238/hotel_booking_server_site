const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 3001;

// ------------ Middleware --------------------
app.use(express.json());
app.use(cors())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cxghft2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const roomsCollection = client.db("fiveStar_hotel").collection("rooms");
    const commentsCollection = client.db("fiveStar_hotel").collection("comments");

    // ------------- Get rooms ----------------------
    app.get("/api/v1/rooms", async(req, res) => {
      const result = await roomsCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/v1/rooms/:roomId", async(req, res) =>{
      const id = req.params.roomId;
      const query = {_id: new ObjectId(id)}
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });

    // --------------- Comments --------------------

    app.post("/api/v1/comments", async(req, res) => {
      const comment = req.body;
      console.log(comment);
      const result = await commentsCollection.insertOne(comment);
      res.send(result); 
    });

    app.get("/api/v1/comments", async(req, res) => {
      const id = req.query.roomId;
      const query = {roomId: id};
      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    });


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Five Star Hotel Backend is Running !')
})

app.listen(port, () => {
  console.log(`Example app listening port: ${port}`)
})