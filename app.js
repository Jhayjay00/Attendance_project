const express = require('express'); 
require('dotenv').config; 
const mongoose = require('mongoose'); 
const jwt = require('jsonwebtoken'); 
const bcrypt = require('bcrypt'); 
const cookieParser = require('cookie-parser'); 
const bodyParser = require('body-parser'); 
const Student = require('./student.js'); 
const Record = require('./record.js')
 
const app = express(); 
 
app.set('view engine','ejs'); 
app.set('views','./views'); 
 
//Middleware use 
app.use(express.static('public')); 
app.use(bodyParser.urlencoded({extended:true})); 
app.use(cookieParser());
 
const url = `mongodb+srv://David:Password@cluster0.4fm7mu2.mongodb.net/`; 
 
app.get('/',(req,res) => { 
 
    const email = req.body.email; 
    const password = req.body.password; 
 
    res.render('login'); 
});


app.post('/',async  (req, res) => {

    const email = req.body.email;
    const password = req.body.password;
    const secretKey = 'my_secret_key';

    //find user in the database by email
    const user = await Student.findOne({email});

    if(!user){
        //user not found
        res.status(404).send('User not Found');
        return;
    }

    //Creating and signing a JWT
    const unique = user._id.toString();


    //create a jwt
    const token =jwt.sign(unique, secretKey);


    //stuff the token inside the cookie 
    res.cookie('jwt', token, {maxAge: 5 * 60 * 1000, httpOnly: true});

    bcrypt.compare(password, user.password, (err, result) =>{

        if (result){
            res.render('attendance');
    } else {
        res.send('Password does not match our records. Please try again')
    }
    });

    jwt.verify(token, secretKey, (err, decoded) =>{
        console.log(token);
        console.log(decoded);
    });

});

 
app.post('/register',(req,res) => { 
    const {email, password, confirmPassword} = req.body; 
    const user = Student.findOne({email}); 
 
    //check if username already exists 
   // if(user){ 
     //   res.status(400).send('Username already exists. Please try again'); 
       // return; 
    //} 
 
    //check if the confirmed password equals the password 
    if(password !== confirmPassword){ 
        res.status(400).send('Passwords do not match. Please try again'); 
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

app.get('/register', (req, res) =>{
    res.render('register');
});
 
app.post('/addstudents', (req, res) =>{

const student = new Record({

    name: req.body.name,
    email:req.body.email
});
    student.save();
    res.redirect('/home');

});



mongoose.connect(url) 
.then(() =>{ 
    console.log('Connected to MongoDB Database'); 
}) 
.catch((err)=>{ 
    console.log(`Error connecting to the database: ${err}`) 
}); 
 

app.get('/home', async (req,res) => {

const students = await Record.find({});

//using max method with cascade operator to perform function on all students
const maxAttendanceCount = Math.max(...students.map(r =>  students.AttendanceCount));



res.render('attendance', {students, maxAttendanceCount});


});



const PORT = process.env.PORT || 3000; 
 
app.listen(PORT, ()=>{ 
    console.log(`Successfully connected to ${PORT}`); 
});