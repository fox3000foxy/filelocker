const images = require('images')
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
const authLink = "https://discord.com/api/oauth2/authorize?client_id=945275650477023233&redirect_uri=http%3A%2F%2Flocalhost%3A53134&response_type=code&scope=identify%20guilds"
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
app.use(fileUpload());
app.use(bodyParser.json())

app.get('/authLink',(req,res)=>{
	res.send(authLink)
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
			return response.sendFile('identify.html', { root: '.' });
		}
	}else{
		return response.sendFile('identify.html', { root: '.' });
	}
});

app.get('/logged',(req,res)=>{
	res.sendFile('logged.html', { root: '.' });
})

app.post('/file/:fileName',function(req,res){
	let userId = req.body.userId
	// if(req)
	if(fs.existsSync(__dirname+"/files/"+req.params.fileName)) {
	LIST = JSON.parse(fs.readFileSync(__dirname + "/uploadList.json").toString())
		LIST.forEach(FILE=>{
			if(userId == FILE.ownerId || FILE.canView.indexOf(userId)!=-1) {
				res.sendFile(__dirname+'/files/'+req.params.fileName)
			}
			else {
				res.status(403).sendFile(__dirname+'/public/canvas-notauthorized.png')
			}
		})
	}
	else {
		res.status(404).sendFile(__dirname+'/public/canvas-notfound.png')
	}
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
		expires: (+new Date) + 86400000,
		canView: JSON.parse(req.body.bar)
	})
	//1 DAY: 86400000 = 1000*60*60*24
	fs.writeFileSync(__dirname + "/uploadList.json",JSON.stringify(LIST))
	//Write uploaded file
	fs.writeFileSync(`${__dirname}/files/${fileName}`,Buffer.from(req.files.foo.data))
	res.redirect('/logged?successful&fileName='+fileName)
  }
  else
	res.redirect('/logged?error')
});

app.get('/file/:fileName',(req,res)=>{
	console.log(req.headers["user-agent"])
	if(req.headers["user-agent"] == "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"){
		LIST = JSON.parse(fs.readFileSync(__dirname + "/uploadList.json").toString())
		let existingFile = false
		LIST.forEach((FILE)=>{
			if(FILE.fileName) {
				existingFile = true
				generatePermissionImage([FILE.ownerId,...FILE.canView]).then(response=>{
					res.sendFile(__dirname+'/generated.png')
					fs.unlinkSync("./generated.png")
				})				
			}
		})
		if(!existingFile) res.sendFile(__dirname+'/public/canvas-notfound.png')
	}
	else{
		res.send(`
			<form method="post" action="/file/${req.params.fileName}" encType="multipart/form-data">
				<input name="userId">
				<input type="submit">
			</form>
			<script>
				if(!localStorage.myData) {
					localStorage.redirectLink = location.href
					location.href='/'
				}
				document.forms[0].userId.value = JSON.parse(localStorage.myData).id
				document.forms[0].submit()
			</script>
		`)
	}
})

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

app.get('*', function(req, res){
  res.status(404).sendFile(__dirname+'/404.html');
});

coordinates = [
	[0,0],
	[0,1],
	[0,2],
	[0,3],
	[1,0],
	[1,1],
	[1,2]
]

const bot = new Discord.Client();
// console.log(bot.users)
bot.on('ready',()=>{
	console.log("Bot ready !")
	//DOWNLOAD ALL PPs
	let guilds = bot.guilds.cache.array();
	for (let i = 0; i < guilds.length; i++) {guilds[i].members.fetch()}
	server.listen(port, () => console.log(`App listening at http://localhost:${port}`));
})

async function generatePermissionImage(ids) {
	canvas = images(867,594).fill(203,65,65)
	layer1 = images("./public/canvas-temp.png").size(867)
	await ids.forEach((id,i)=>{
		coords = coordinates[i]
		if(coords){
			getPP(id).then((res)=>{
				pp = images(res).size(123)
				canvas.draw(pp,226+136*coords[0],271+126*coords[1])
				if(i==ids.length-1){
					canvas.draw(layer1,0,0)
					return canvas.save("./generated.png")
				}
			})
		}
	})
	return;
}

async function getPP(id) {
	let finalBuffer;
	let avatarURL = bot.users.cache.get(id).avatarURL({ format: 'png' })
	return fetch(avatarURL).then(function(res) {return buffer = res.buffer().then(res2=>{return res2})})
}

bot.login('OTQ1Mjc1NjUwNDc3MDIzMjMz.YhNyjQ.ZWm24Yi2SmSitA-iQNZVIcELhk0')

io.on('connection', (socket) => {
  // console.log('a user connected');
  socket.on('search',({name,id})=>{
	let users = []
	let usersId = []
	let guilds = bot.guilds.cache.array();
	for (let i = 0; i < guilds.length; i++) {
	  guilds[i].members.fetch().then(r=>{
		  r.array().sort().forEach(r => {
			let username = `${r.user.username}#${r.user.discriminator}`;
			// console.log(username.indexOf(name))
			if(username.toLowerCase().indexOf(name.toLowerCase())!=-1 && usersId.indexOf(r.user.id)==-1){
				users.push({username,avatarLink:r.user.avatarURL(),id:r.user.id});
				usersId.push(r.user.id)
			}
		  });
		  io.emit('search',{id,users})
	  })
	}
  })
});

