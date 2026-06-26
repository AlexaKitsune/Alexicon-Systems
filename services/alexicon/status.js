const express = require('express');
const router = express.Router();

// GET /alexicon/on
router.get('/', (req, res) => {
    res.json({ active: true });
});

module.exports = router;