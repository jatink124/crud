// backend/routes/strategy.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs

const router = express.Router();
const strategiesPath = path.join(__dirname, 'strategies.json');

// Helper function to read data from file
const readData = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
};

// Helper function to write data to file
const writeData = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Read all strategies
router.get('/strategies', (req, res) => {
  const data = readData(strategiesPath);
  res.json(data);
});

// Create a new strategy
router.post('/strategies', (req, res) => {
  const data = readData(strategiesPath);
  const newStrategy = req.body;

  // Generate unique ID for new strategy
  if (!newStrategy.id) {
    newStrategy.id = uuidv4();
  }

  // Ensure index is unique
  data.push(newStrategy);
  writeData(strategiesPath, data);
  res.status(201).json(newStrategy);
});

// Update an existing strategy
router.put('/strategies/:id', (req, res) => {
  const data = readData(strategiesPath);
  const { id } = req.params;
  const updatedStrategy = req.body;

  const itemIndex = data.findIndex(item => item.id === id);

  if (itemIndex !== -1) {
    data[itemIndex] = { ...data[itemIndex], ...updatedStrategy };
    writeData(strategiesPath, data);
    res.json(data[itemIndex]);
  } else {
    res.status(404).json({ message: 'Strategy not found' });
  }
});

// Delete a strategy
router.delete('/strategies/:id', (req, res) => {
  const data = readData(strategiesPath);
  const { id } = req.params;
  const newData = data.filter(item => item.id !== id);
  writeData(strategiesPath, newData);
  res.status(204).send();
});

module.exports = router;
