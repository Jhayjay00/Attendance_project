const express = require('express');
require('dotenv').config;
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const Student = require('./student.js');
const Record = require('./record.js');
const app = express();


app.set('view engine', 'ejs');
app.set('views', './views');

//Middleware (use)
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
 
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
  const secretKey = 'my_secret_key';

  //Find user in the database by email
  const user =  await Student.findOne({email});

  if(!user){
    //User not found
    res.status(404).send('User not found');
    return;
  }

  //Creating and signing a JWT
  const unique = user._id.toString();

  //Create a jwt
  const token = jwt.sign(unique, secretKey);
  
  //Stuff the token (jwt) inside the cookie and issue it
   res.cookie('jwt', token, {maxAge: 5 * 60 * 1000, httpOnly: true});

   bcrypt.compare(password, user.password, (err, result) =>{

    if(result){
        res.redirect('home');
    } else {
      res.send('Password does not match our records. Please try again')
    }
  });

  jwt.verify(token, secretKey, (err, decoded) =>{
    console.log(token);
   console.log(decoded);
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




app.get('/home', async (req, res) =>{

  const students = await Record.find({});

  //Using max method with cascade operator to perform function on all students
  const maxAttendanceCount = Math.max(...students.map(student => student.attendanceCount));
  

  res.render('attendance.ejs', {students, maxAttendanceCount});

});

app.post('/update-student', async (req, res) =>{

const attendanceDate  = req.body.attendanceDate;

const length =req.body.attendance ? req.body.attendance.length: 0;

console.log(req.body.email2);

try{
   for(let i = 0; i < length; i++){
     const studentId =req.body.attendance[i];
     const result = await Record.findByIdAndUpdate(
         studentId,
        {
             $inc: {attendanceCount: 1},
             $set: {attendanceDate: new Date(attendanceDate)}
        },
          {new: true},
     );
    res.redirect('/home');
    }
} catch(err){
    res.status(500).send("an unknown error has occured while updating student records.");

}




});


const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log(`Successfully connected to ${PORT}`);
});