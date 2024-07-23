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
const repFilePath = path.join(__dirname, 'dailyreportdata.json');

// Helper function to read data from file
const readData = (filePath) => {
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
};

// Helper function to write data to file
const writeData = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// CRUD operations

// Read data from 'data.json'
app.get('/data', (req, res) => {
  const data = readData(filePath);
  res.json(data);
});

// Read data from 'dailyreportdata.json'
app.get('/repdata', (req, res) => {
  const data = readData(repFilePath);
  res.json(data);
});

// Create a new entry in 'data.json'
app.post('/data', (req, res) => {
  const data = readData(filePath);
  const newItem = req.body;

  // If there are already two records, delete them
  if (data.length >= 2) {
    data.splice(0, 2); // Remove the first two records
  }

  // Add the new record
  data.push(newItem);
  writeData(filePath, data);

  res.status(201).json(newItem);
});

// Create a new entry in 'dailyreportdata.json'
app.post('/repdata', (req, res) => {
  const data = readData(repFilePath);
  const newItem = req.body;

  // Add the new record
  data.push(newItem);
  writeData(repFilePath, data);

  res.status(201).json(newItem);
});

// Update an entry in 'data.json'
app.put('/data/:index', (req, res) => {
  const data = readData(filePath);
  const { index } = req.params;
  const itemIndex = data.findIndex(item => item.index === index);

  if (itemIndex !== -1) {
    data[itemIndex] = req.body;
    writeData(filePath, data);
    res.json(data[itemIndex]);
  } else {
    res.status(404).json({ message: 'Item not found' });
  }
});

// Delete an entry from 'data.json'
app.delete('/data/:index', (req, res) => {
  const data = readData(filePath);
  const { index } = req.params;
  const newData = data.filter(item => item.index !== index);
  writeData(filePath, newData);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
