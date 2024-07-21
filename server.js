const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const filePath = path.join(__dirname, 'data.json');

// Helper function to read data from file
const readData = () => {
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
};

// Helper function to write data to file
const writeData = (data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// CRUD operations

// Read
app.get('/data', (req, res) => {
  const data = readData();
  res.json(data);
});

// Create
app.post('/data', (req, res) => {
  const data = readData();
  const newItem = req.body;

  // If there are already two records, delete them
  if (data.length >= 2) {
    data.splice(0, 2); // Remove the first two records
  }

  // Add the new record
  data.push(newItem);
  writeData(data);

  res.status(201).json(newItem);
});

// Update
app.put('/data/:index', (req, res) => {
  const data = readData();
  const { index } = req.params;
  const itemIndex = data.findIndex(item => item.index === index);

  if (itemIndex !== -1) {
    data[itemIndex] = req.body;
    writeData(data);
    res.json(data[itemIndex]);
  } else {
    res.status(404).json({ message: 'Item not found' });
  }
});

// Delete
app.delete('/data/:index', (req, res) => {
  const data = readData();
  const { index } = req.params;
  const newData = data.filter(item => item.index !== index);
  writeData(newData);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
