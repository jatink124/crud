const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const predictionsPath = path.join(__dirname, 'predictions.json');

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

// Read all predictions
router.get('/predictions', (req, res) => {
  const data = readData(predictionsPath);
  res.json(data);
});

// Create a new prediction
router.post('/predictions', (req, res) => {
  const data = readData(predictionsPath);
  const newPrediction = req.body;

  // Ensure index is unique
  const lastIndex = data.length > 0 ? data[data.length - 1].index : 0;
  newPrediction.index = lastIndex + 1;

  data.push(newPrediction);
  writeData(predictionsPath, data);
  res.status(201).json(newPrediction);
});

// Update an existing prediction
router.put('/predictions/:index', (req, res) => {
  const data = readData(predictionsPath);
  const { index } = req.params;
  const updatedPrediction = req.body;

  const itemIndex = data.findIndex(item => item.index === parseInt(index));

  if (itemIndex !== -1) {
    data[itemIndex] = { ...data[itemIndex], ...updatedPrediction };
    writeData(predictionsPath, data);
    res.json(data[itemIndex]);
  } else {
    res.status(404).json({ message: 'Prediction not found' });
  }
});

// Delete a prediction
router.delete('/predictions/:index', (req, res) => {
  const data = readData(predictionsPath);
  const { index } = req.params;
  const newData = data.filter(item => item.index !== parseInt(index));
  writeData(predictionsPath, newData);
  res.status(204).send();
});

module.exports = router;
