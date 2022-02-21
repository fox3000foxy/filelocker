const fetch = require('node-fetch');
const express = require('express');
const fileUpload = require('express-fileupload');
var bodyParser = require('body-parser')
const http = require('http');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Discord = require('discord.js');
const { clientId, clientSecret, port } = {
	"clientId": "945275650477023233",
	"clientSecret": "rdgxhAH_lZtQy-BqyX8id-a8DLKtx2zC",
	"port": 53134
};

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
app.use(fileUpload());
app.use(bodyParser.json())

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
			console.log(userResultJSON);
			// console.log(oauthData);
			if(userResultJSON.message) {
				return response.sendFile('index.html', { root: '.' });				
			}
			else {
				dataOfUser = JSON.stringify({
					user:userResultJSON,
					guilds:guildsResultJSON
				},null, 4)
				userPath = `${__dirname}/users/${userResultJSON.id}.json`
				// console.log(userPath)
				fs.writeFileSync(userPath,dataOfUser)
				// response.setHeader('Content-Type', 'application/json');
				// response.send(dataOfUser)
				// response.redirect('/login?id='+userResultJSON.id)
				// response.redirect('/logged')
				response.send(`
					<script>
						localStorage.setItem('myData',JSON.stringify(${JSON.stringify(userResultJSON)}))
						location.href = '/logged'
					</script>
				`)
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

app.get('/logged',(req,res)=>{
	res.sendFile('logged.html', { root: '.' });
})

app.post('/upload', function(req, res) {
  console.log(req.files.foo); // the uploaded file object
  if(req.files.foo){
	ext = req.files.foo.name.split('.').pop();
	fileName = `${req.body.id}_${uuidv4()}.${ext}`
	
	//Add uploaded file to LIST
	LIST = JSON.parse(fs.readFileSync(__dirname + "/uploadList.json").toString())
	LIST.push({
		fileName,
		ownerId: req.body.id,
		expires: (+new Date) + 10000
	})
	//1 DAY: 86400000 = 1000*60*60*24
	fs.writeFileSync(__dirname + "/uploadList.json",JSON.stringify(LIST))
	//Write uploaded file
	fs.writeFileSync(`${__dirname}/files/${fileName}`,Buffer.from(req.files.foo.data))
	res.redirect('/logged?successful')
  }
  else
	res.redirect('/logged?error')
});

//Expires delete
setInterval(()=>{
	let removedOneFile = false;
	LIST = JSON.parse(fs.readFileSync(__dirname + "/uploadList.json").toString())
	LIST.forEach((FILE,i)=>{
		if(FILE.expires<(+new Date)) {
			LIST.splice(i,1)
			fs.unlinkSync(`${__dirname}/files/${FILE.fileName}`)
			removedOneFile = true
		}
	})
	if(removedOneFile)
		fs.writeFileSync(__dirname + "/uploadList.json",JSON.stringify(LIST))
},5000)

app.use(express.static('./public'))

const bot = new Discord.Client();
// console.log(bot.users)
bot.on('ready',()=>{
	console.log("Bot ready !")
})
bot.on('message',(msg)=>{
	// console.log(msg.author.username+": "+msg.content)
})
bot.login('OTQ1Mjc1NjUwNDc3MDIzMjMz.YhNyjQ.ZWm24Yi2SmSitA-iQNZVIcELhk0')

io.on('connection', (socket) => {
  // console.log('a user connected');
  socket.on('search',({name,id})=>{
	let users = []
	let guilds = bot.guilds.cache.array();
	for (let i = 0; i < guilds.length; i++) {
	  guilds[i].members.fetch().then(r=>{
		  r.array().sort().forEach(r => {
			let username = `${r.user.username}#${r.user.discriminator}`;
			// console.log(username.indexOf(name))
			if(username.toLowerCase().indexOf(name.toLowerCase())!=-1)
				users.push({username,avatarLink:r.user.avatarURL()});
		  });
		  io.emit('search',{id,users})
	  })
	}
  })
});

server.listen(port, () => console.log(`App listening at http://localhost:${port}`));
