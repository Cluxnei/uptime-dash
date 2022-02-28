const {populateDatabase, closeConnection} = require('./database.js');
const {getMonitors, runMonitors, stopMonitors} = require('./monitor.js');
const {renderMonitor} = require('./render.js');

const start = async () => {
    let monitorsIds = [];
    try {
        console.log('Populating database...');
        await populateDatabase();
        console.log('Getting monitors...');
        const monitors = await getMonitors();
        console.log('Running monitors...');
        monitorsIds = await runMonitors(monitors, (monitor) => {
            console.log(`Monitor ${monitor.name} runned successfully`);
            renderMonitor(monitor);
        }, (monitor, error) => {
            console.log(`Monitor ${monitor.name} runned with error: ${error.message}`);
            console.error(error);
            renderMonitor(monitor);
        });
        console.log('Rendering monitors...');
        monitors.forEach((monitor) => {
            renderMonitor(monitor);
        });

    } catch (error) {
        console.log('Stopping monitors...');
        stopMonitors(monitorsIds);
        console.error(error);     
        process.exit(1);
    }

    process.on('SIGINT', () => {
        console.log('Gracefully shutting down from SIGINT (Ctrl-C)');
        console.log('Stopping monitors...');
        stopMonitors(monitorsIds);
        console.log('Closing database connection...');
        closeConnection().then(() => {
            console.log('Database closed...');
            console.log('Exiting...');
            process.exit(0);
        });
    });
};

start();







