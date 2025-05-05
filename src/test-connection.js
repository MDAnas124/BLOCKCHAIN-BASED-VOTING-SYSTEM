// Test script to verify server connectivity
async function testConnection(url) {
    try {
        console.log(`Testing connection to: ${url}`);
        const response = await fetch(`${url}/ping`);
        const data = await response.json();
        console.log(`Response from ${url}:`, data);
        return true;
    } catch (error) {
        console.error(`Error connecting to ${url}:`, error.message);
        return false;
    }
}

// Test both servers
async function testServers() {
    const mainServer = window.API_CONFIG.API_URL;
    const fallbackServer = window.API_CONFIG.FALLBACK_API_URL;

    console.log('Testing main server...');
    const mainServerWorking = await testConnection(mainServer);
    
    if (!mainServerWorking) {
        console.log('Testing fallback server...');
        const fallbackServerWorking = await testConnection(fallbackServer);
        
        if (!fallbackServerWorking) {
            console.error('Both servers are unreachable!');
            return false;
        }
    }
    
    return true;
}

// Run the test
testServers().then(success => {
    if (success) {
        console.log('Server connection test completed successfully');
    } else {
        console.error('Server connection test failed');
    }
}); 