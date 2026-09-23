(function(){try{var t=localStorage.getItem('mady-theme');var d=t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();
// Navy de auth pre-montaje: evita el destello del fondo claro antes de que
// React monte y pinte la pantalla de carga navy de Login.tsx. Acotado por
// pathname a las 3 rutas de auth — nunca toca el resto de la app (el
// dashboard sigue arrancando con el fondo normal). Se limpia en App.tsx
// justo después del primer montaje. Única excepción documentada al uso de
// hex literal fuera de theme.css: este script corre antes de que exista
// el CSS/los custom properties.
(function(){try{var p=location.pathname;if(p==='/login'||p==='/registro'||p==='/restablecer-contrasena'){document.documentElement.style.background='#173251';}}catch(e){}})();
