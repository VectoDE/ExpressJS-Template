axios.post('/auth/register', userData, {
    
})
.then(response => {
    console.log(response.data);
})
.catch(error => {
    console.error(error);
});
