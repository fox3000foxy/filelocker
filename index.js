const fetch = require('node-fetch');
const express = require('express');
const { clientId, clientSecret, port } = {
	"clientId": "945275650477023233",
	"clientSecret": "rdgxhAH_lZtQy-BqyX8id-a8DLKtx2zC",
	"port": 53134
};

const app = express();

app.get('/authLink',(req,res)=>{
	res.send("https://discord.com/api/oauth2/authorize?client_id=945275650477023233&redirect_uri=http%3A%2F%2Flocalhost%3A53134&response_type=code&scope=identify%20guilds")
})
app.get('/', async ({ query }, response) => {
	const { code } = query;

	if (code) {
		try {
			const oauthResult = await fetch('https://discord.com/api/oauth2/token', {
				method: 'POST',
				body: new URLSearchParams({
					client_id: clientId,
					client_secret: clientSecret,
					code,
					grant_type: 'authorization_code',
					redirect_uri: `http://localhost:${port}`,
					scope: 'identify,guilds',
				}),
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			});

			const oauthData = await oauthResult.json();
			const userResult = await fetch('https://discord.com/api/users/@me', {
				headers: {
					authorization: `${oauthData.token_type} ${oauthData.access_token}`,
				},
			});
			const guildsResult = await fetch('https://discord.com/api/users/@me/guilds', {
				headers: {
					authorization: `${oauthData.token_type} ${oauthData.access_token}`,
				},
			});
			userResultJSON = await userResult.json()
			guildsResultJSON = await guildsResult.json()
			// console.log("User:",userResultJSON);
			// console.log(oauthData);
			if(userResultJSON.message) {
				return response.sendFile('index.html', { root: '.' });				
			}
			else {
				response.setHeader('Content-Type', 'application/json');
				return response.send(JSON.stringify({
					user:userResultJSON,
					guilds:guildsResultJSON
				},null, 4))
				// response.redirect('/login?id='+userResultJSON.id)
			}
		} catch (error) {
			// NOTE: An unauthorized token will not throw an error;
			// it will return a 401 Unauthorized response in the try block above
			console.error(error);
			return response.sendFile('index.html', { root: '.' });
		}
	}else{
		return response.sendFile('index.html', { root: '.' });
	}
});

app.listen(port, () => console.log(`App listening at http://localhost:${port}`));
