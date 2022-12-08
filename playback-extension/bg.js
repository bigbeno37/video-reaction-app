let connections = [];

console.log('Running...');

browser.runtime.onConnect.addListener(port => {
    connections.push(port);

    port.onMessage.addListener(message => {
        console.log('received message', message);
        connections.filter(conn => conn !== port).forEach(conn => {
            console.log('sending message to connection...');
            conn.postMessage(message)
        });
    });

    port.onDisconnect.addListener(port => {
        connections = connections.filter(conn => conn !== port);
    });
});