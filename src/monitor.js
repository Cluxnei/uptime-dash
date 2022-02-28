const axios = require('axios');
const {select, insert} = require('./database.js');

const getMonitors = async () => {
    const sql = 'SELECT * FROM monitors;';
    const params = [];
    const rows = await select(sql, params);
    return rows;
};

const runMonitor = async (monitor, callback) => {
    const startTime = new Date();
    try {
        const response = await axios.call(monitor.method, monitor.url, {
            maxRedirects: monitor.max_redirects,
            validateStatus: (status) => {
                return status >= monitor.min_acceptable_status_code && status <= monitor.max_acceptable_status_code;
            },
            headers: monitor.headers && monitor.headers.length ? JSON.parse(monitor.headers) : {},
            data: monitor.body && monitor.body.length ? JSON.parse(monitor.body) : {},
        });
        const endTime = new Date();
        const responseTimeInMs = endTime.getTime() - startTime.getTime();
        await insert('monitor_heart_beats', {
            monitor_id: monitor.id,
            status_code: response.status,
            response_time: responseTimeInMs,
        });
    } catch (error) { 
        if (error.isAxiosError) {       
            await insert('monitor_failures', {
                monitor_id: monitor.id,
                status_code: error.response.status,
                response_time: Math.round(startTime.getTime() - (new Date()).getTime()),
            });
        }
        console.error(error);
    } finally {
        callback(monitor);
    }
};

const runMonitors = async (monitors, callback) => {
    const intervalIds = [];
    monitors.forEach((monitor) => {
        const intervalId = setInterval(async () => {
            await runMonitor(monitor, callback);
        }, monitor.heart_beat_interval * 1000);
        intervalIds.push(intervalId);
    });
    return intervalIds;
};

const stopMonitors = (intervalIds) => {
    intervalIds.forEach((intervalId) => {
        clearInterval(intervalId);
    });
};

module.exports = {
    getMonitors,
    runMonitors,
    stopMonitors,
};