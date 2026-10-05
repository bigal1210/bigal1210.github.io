performance.mark('watermelon-start');
document.querySelector('#fallback a').href = location.href;
import('./watermelon.js?v=object-links-1').catch(error => {
    document.querySelector('#loading').hidden = true;
    document.querySelector('#fallback').hidden = false;
    document.querySelector('.hint').hidden = true;
    console.error('Watermelon could not load:', error);
});
