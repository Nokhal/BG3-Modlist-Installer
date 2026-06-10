const express = require('express');
const path = require('path');
const routes = require('./routes');

const app = express();
const port = 3001;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);

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
