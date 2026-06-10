const express = require('express');
const path = require('path');

const app = express();
const port = 3001;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
	res.render('index', {
		title: 'BG3 Ad Fundamenta Redire',
		headline: 'Welcome home',
		description: 'A basic Express server rendering an EJS homepage on port 3001.',
	});
});

function startServer() {
	app.listen(port, () => {
		console.log(`Server is running on http://localhost:${port}`);
	});
}

if (require.main === module) {
	startServer();
}

module.exports = app;
module.exports.startServer = startServer;
