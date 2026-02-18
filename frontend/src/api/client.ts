import axios from 'axios';

// En Vercel usaremos la variable de entorno. En local, el proxy.
const baseURL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
    baseURL: baseURL,
    withCredentials: true, // Importante para las cookies
    xsrfCookieName: 'csrftoken',
    xsrfHeaderName: 'X-CSRFToken',
    headers: {
        'Content-Type': 'application/json',
    }
});

export default client;