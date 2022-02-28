const renderMonitor = (monitor) => {
    console.log(`monitor(${monitor.id}): ${monitor.name} => (${monitor.url}) => (${monitor.status || 'unknown'})`);
};

module.exports = {
    renderMonitor,
};