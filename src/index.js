const {populateDatabase, closeConnection} = require('./database.js');
const {getMonitors, runMonitors, stopMonitors} = require('./monitor.js');
const {renderMonitor} = require('./render.js');

(async () => {
    let monitorsIds = [];
    try {
        console.log('Populating database...');
        await populateDatabase();
        console.log('Getting monitors...');
        const monitors = await getMonitors();
        console.log('Running monitors...');
        monitorsIds = await runMonitors(monitors, (monitor) => {
            console.log(`Monitor ${monitor.name} is running...`);
            renderMonitor(monitor);
        });

        monitors.forEach((monitor) => {
            renderMonitor(monitor);
        });

    } catch (error) {
        console.error(error);     
    }

    process.on('SIGINT', async () => {
        console.log('Gracefully shutting down from SIGINT (Ctrl-C)');
        console.log('Stopping monitors...');
        stopMonitors(monitorsIds);
        console.log('Closing database connection...');
        await closeConnection();
        console.log('Exiting...');
        process.exit(0);
    });

})();




