// Load the Socket.IO client from the same backend origin used by API requests.
// document.write keeps the client script ordered before socket.js initializes.
if (typeof CONFIG !== 'undefined' && CONFIG.SOCKET_URL) {
    document.write(`<script src="${CONFIG.SOCKET_URL}/socket.io/socket.io.js"><\/script>`);
}
