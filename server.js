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
const tradersdiaryPath = path.join(__dirname, 'tradersdiary.json');

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

// Read data from 'tradersdiary.json'
app.get('/tradersdiary', (req, res) => {
  const data = readData(tradersdiaryPath);
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

// Create a new entry in 'tradersdiary.json'
app.post('/tradersdiary', (req, res) => {
  const data = readData(tradersdiaryPath);
  const newItem = req.body;

  // Parse index values to ensure they are treated as numbers
  data.forEach(item => {
    item.index = parseInt(item.index);
  });

  // Calculate the next index based on existing data length
  const lastIndex = data.length > 0 ? data[data.length - 1].index : 0;
  newItem.index = lastIndex + 1; // Increment the last index to assign a new one

  // Add the new record
  data.push(newItem);
  writeData(tradersdiaryPath, data);

  res.status(201).json(newItem);
});

// Endpoint to get last index from 'tradersdiary.json'
app.get('/tradersdiary/lastIndex', (req, res) => {
  const data = readData(tradersdiaryPath);
  if (data.length === 0) {
    res.status(404).json({ message: 'No entries found' });
  } else {
    const lastIndex = data[data.length - 1].index;
    res.json({ index: lastIndex });
  }
});

// Update an entry in 'tradersdiary.json'
app.put('/tradersdiary/:index', (req, res) => {
  const data = readData(tradersdiaryPath);
  const { index } = req.params;
  const updatedEntry = req.body;

  // Find the entry to update
  const itemIndex = data.findIndex(item => item.index === parseInt(index));

  if (itemIndex !== -1) {
    // Update the entry
    data[itemIndex] = { ...data[itemIndex], ...updatedEntry };
    writeData(tradersdiaryPath, data);
    res.json(data[itemIndex]);
  } else {
    res.status(404).json({ message: 'Entry not found' });
  }
});

// Delete an entry from 'tradersdiary.json'
app.delete('/tradersdiary/:index', (req, res) => {
  const data = readData(tradersdiaryPath);
  const { index } = req.params;
  const newData = data.filter(item => item.index !== parseInt(index));
  writeData(tradersdiaryPath, newData);
  res.status(204).send();
});

// Update an entry in 'data.json'
app.put('/data/:index', (req, res) => {
  const data = readData(filePath);
  const { index } = req.params;
  const itemIndex = data.findIndex(item => item.index === parseInt(index));

  if (itemIndex !== -1) {
    data[itemIndex] = { ...data[itemIndex], ...req.body };
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
  const newData = data.filter(item => item.index !== parseInt(index));
  writeData(filePath, newData);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
