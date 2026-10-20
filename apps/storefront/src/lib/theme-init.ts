// Static, application-owned bootstrap: preserve published CMS colors in light mode.
export const themeScript = `(function(){var p='system';try{var v=localStorage.getItem('commerce-storefront-theme');if(v==='dark'||v==='light')p=v}catch(e){}document.documentElement.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p})()`;
