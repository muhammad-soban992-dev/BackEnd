import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()
import {DB_NAME} from "../constants.js"

console.log(DB_NAME)
const connectDB = async ()=>{
    try {
    const connectionInstance=await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    console.log(`\n MongoDB connected !! DB HOST:${connectionInstance.connection.host}`)

    } catch (error) {
      console.log("MONGODB connection error",error)    
    }
}
   export default connectDB