performance.mark('watermelon-start');
import('./watermelon.js?v=rind-spin-1').catch(error => {
    document.querySelector('#loading').hidden = true;
    document.querySelector('#fallback').hidden = false;
    document.querySelector('.hint').hidden = true;
    console.error('Watermelon could not load:', error);
});
