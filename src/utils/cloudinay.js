import  {v2 as cloudinary} from "cloudinary"
import fs from "fs"

    // cloudinary Configuration
    cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY , 
        api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View API Keys' above to copy your API secret
    });

    const uploadONCloudinay = async (filePath)=>{
        try{ 
            if(!filePath) return null

             let response = await cloudinary.uploader.upload(filePath, 
                {
                    resource_type: "auto"
                }
            )
        console.log("file upoladed successfully", response.url);
        return response;
        }catch(error){
            fs.unlinkSync(filePath);  // removes files incase of error
            return  null;
        }
    }
    

    export {uploadONCloudinay}
