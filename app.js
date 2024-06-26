const express = require('express');
require('dotenv').config;
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const Student = require('./student.js');
const Record = require('./record.js');
const student = require('./student.js');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan')
const secretKey = 'my_secret_key';
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = YAML.load('./swagger.yaml'); //load your Swagger YAML file
const path = require('path');
const fs = require('fs')
const app = express();


app.set('view engine', 'ejs');
app.set('views', './views');

//Middleware (use)
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(session({
  secret: secretKey,
  resave: false,
  saveUninitialized: false,
}))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

//create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a'})

//setup the logger 
app.use(morgan('combined', {stream: accessLogStream}));


//High-level middleware function for JWT authentication
function authenticateToken(req, res, next){

    const token = req.cookies.jwt;

    if(token){


      jwt.verify(token, secretKey, (err, decoded) => {

          if(err) {
            return res.status(401).send('Invalid Token');
          }

            req.userId = decoded;

          next();
      })
    } else {
      res.status(401).render('401');
    }
}

//Rate limit configuration
const apLimiter = rateLimit({
  windowsMS: 1 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  LegacyHeaders: false,
});
 
const url = `mongodb+srv://David:Password@cluster0.4fm7mu2.mongodb.net/`; 
 
mongoose.connect(url)
.then(() =>{
  console.log('Connected to MongoDB Database');
})
.catch((err)=>{
  console.log(`Error connecting to the database: ${err}`)
});


app.get('/', (req, res) =>{
  res.render('login');
});



app.post('/' , async (req, res) => {

  const email = req.body.email;
  const password = req.body.password;
  

  //Find user in the database by email
  const user =  await Student.findOne({email});

  if(!user){
    //User not found
    res.status(404).send('User not found');
    return;
  }

  //Creating and signing a JWT
  const unique = user._id.toString();


  //Storing userId in the session
  req.session.userId = user._id.toString();

  //Create a jwt
  const token = jwt.sign(unique, secretKey);
  
  //Stuff the token (jwt) inside the cookie and issue it
   res.cookie('jwt', token, {maxAge: 5 * 60 * 5000, httpOnly: true});

   bcrypt.compare(password, user.password, (err, result) =>{

    if(result){
        res.redirect('home');
    } else {
      res.send('Password does not match our records. Please try again')
    }
  });

});


app.post('/register', (req, res) =>{

  const {email, password, confirmPassword} = req.body;

  const user = Student.findOne({email});

  //Check if username already exists.  
  //if(user){
    //  res.status(400).send('Username already exists.  Please try again');
     // return;
  //}

   //Check if the confirm password equals the password
   if(password !== confirmPassword){
    res.status(400).send('Passwords do not match!');
    return;
}

bcrypt.hash(password, 12, (err, hashedPassword) =>{

const user = new Student({
  email: email,
  password: hashedPassword,
});

user.save();

res.redirect('/');

});
});


app.get('/register', (req, res) => {
res.render('register');
});


app.post('/addstudent', (req, res) =>{

const student = new Record({
name: req.body.name,
email: req.body.email
});

student.save();

res.redirect('/home');

});


app.post('/deletestudent', async (req, res) =>{

const studentName = req.body.name;
const trimmedName = studentName.trim();

try{
const result = await Record.deleteOne({ name: studentName});

if(result.deletedCount === 0){
  res.status(404).send('User does not exist.  Try again.');
} else {
  res.redirect('/home');
}

} catch(error){

}

});




app.get('/home', authenticateToken,  async (req, res) =>{

const students = await Record.find({});

//Using max method with cascade operator to perform function on all students
const maxAttendanceCount = Math.max(...students.map(student => student.attendanceCount));


res.render('attendance.ejs', {students, maxAttendanceCount});

});




app.post('/update-student', async (req, res) =>{

const attendanceDate  = req.body.attendanceDate;
const length = req.body.attendance ? req.body.attendance.length: 0;


try {
  for(let i = 0; i < length; i++){

    const studentId = req.body.attendance[i];
    const result = await Record.findByIdAndUpdate(
      studentId,
      {
        $inc: {attendanceCount: 1},
        $set: {attendanceDate: new Date(attendanceDate)}
      },
      {new: true},
    );
  }
  return res.status(200).redirect('/home');
} catch(err){
 res.status(500).send("An unknown error has occurred while updating student records.");
}
});

app.get('/api/v2', apLimiter, async (req, res) => {
try {
 const records = await Record.find({});
 const formatted = JSON.stringify(records);
 res.send(formatted);
} catch (error) {
 console.error("Error fetching records:", error);
 res.status(500).send("Error fetching records");
}
});

app.post('/api/v2', async (req, res) =>{

  try{
    const {name, email} = req.body;

    //create the new student record
    const student = new Record({
      name: name,
      email: email,
    });

    await student.save(); 
      res.status(200).json({message: "student record sucessfully created."});
    }catch(error){
    res.status(500).json({message: "Error occured while adding student record"});
   } 
  });



app.post('/reset', async (req, res) =>{

try{
const students = await Record.find({});

for(let i = 0; i < students.length; i++){
students[i].attendanceCount = 0;
await students[i].save();
}

res.redirect('/home');

}catch(error){

res.status(500).send("An unknown error has occurred while updating student records.");

}
});

app.post('/logout', (req, res) =>{

  res.clearCookie('jwt');

  req.session.userId = null;

  req.session.destroy((err) =>{
    if(err){
      res.status(500).send('Internal Server Error');
    }else{
      res.redirect('/');
    }

  }); 
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
console.log(`Successfully connected to ${PORT}`);
});