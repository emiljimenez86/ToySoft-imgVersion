let deferredPrompt;
const installButton = document.getElementById('installButton');

// Función para detectar Brave de manera más precisa
function isBraveBrowser() {
    // Verificar si es Brave usando múltiples métodos
    const userAgent = navigator.userAgent.toLowerCase();
    const isBrave = userAgent.includes('brave') || 
                   (navigator.brave && typeof navigator.brave.isBrave === 'function') ||
                   (window.chrome && window.chrome.webstore === undefined);
    
    console.log('Detectando Brave:', isBrave);
    return isBrave;
}

// Función para mostrar el botón
function showInstallButton() {
    if (installButton) {
        installButton.style.display = 'block';
    }
}

// Función para ocultar el botón
function hideInstallButton() {
    if (installButton) {
        installButton.style.display = 'none';
        // Guardar en localStorage que la app está instalada
        localStorage.setItem('appInstalled', 'true');
    }
}

// Verificar si la app ya está instalada
if (window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone === true ||
    localStorage.getItem('appInstalled') === 'true') {
    hideInstallButton();
}

// Escuchar el evento beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
});

// Escuchar el evento appinstalled
window.addEventListener('appinstalled', (evt) => {
    console.log('App instalada exitosamente');
    hideInstallButton();
    deferredPrompt = null;
});

// Función para instalar la aplicación
async function installPWA() {
    try {
        // Registrar el Service Worker primero
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('ServiceWorker registrado:', registration);

        // Esperar a que el Service Worker esté activo
        await navigator.serviceWorker.ready;
        console.log('ServiceWorker listo');

        if (deferredPrompt) {
            // Mostrar el prompt de instalación
            deferredPrompt.prompt();
            
            // Esperar la respuesta del usuario
            const choiceResult = await deferredPrompt.userChoice;
            
            if (choiceResult.outcome === 'accepted') {
                console.log('Usuario aceptó la instalación');
                alert('¡Instalación exitosa! La aplicación se ha instalado en su escritorio.');
            } else {
                console.log('Usuario rechazó la instalación');
                showInstallInstructions();
            }
            
            deferredPrompt = null;
        } else {
            showInstallInstructions();
        }
    } catch (error) {
        console.error('Error durante la instalación:', error);
        showInstallInstructions();
    }
}

// Función para mostrar instrucciones de instalación
function showInstallInstructions() {
    const instructions = 'Para instalar ToySoft POS:\n\n' +
                        '1. Haga clic en el menú del navegador (tres líneas o puntos)\n' +
                        '2. Seleccione "Instalar ToySoft POS" o "Añadir a pantalla de inicio"\n' +
                        '3. Confirme la instalación\n\n' +
                        'Si no ve la opción de instalación:\n' +
                        '- Asegúrese de estar usando la última versión del navegador\n' +
                        '- Intente recargar la página\n' +
                        '- Verifique que tiene permisos de instalación';
    
    alert(instructions);
}

// Registrar el Service Worker al cargar la página
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('ServiceWorker registrado:', registration);
        } catch (error) {
            console.error('Error al registrar ServiceWorker:', error);
        }
    });
}

// Función para detectar el navegador
function getBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
        return 'chrome';
    } else if (userAgent.includes('brave')) {
        return 'brave';
    } else if (userAgent.includes('edg')) {
        return 'edge';
    }
    return 'other';
} 