const express = require('express');
const app = express();
const cors = require('cors'); 
const bodyParser = require('body-parser');
const axios = require('axios');
const sslChecker = require('ssl-checker');
require('dotenv').config(); 

// accept cors from origin
app.use(cors());
app.use(cors({ origin: 'http://localhost:4200' }));

app.use(bodyParser.json()); // Para analizar datos JSON
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(3000, () => {
    console.log('listening on port 3000');
})

// MYSQL CONNECTION
var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : process.env.host,
  user     : process.env.user,
  password : process.env.password,
  database : process.env.database
});
 
connection.connect();
 
connection.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
  if (error) throw error;
  console.log('The solution is: ', results[0].solution);
});


app.post('/', async (req, res) => {
    try {
      const url = req.body.url;
  
      if (!url) {
        return res.status(400).json({ response: 'URL no proporcionada', status: 400 });
      }
  
      const findUrl = await axios.get(url);
  
      res.status(200).json({ response: 'up', status: 200 }); // Indicar que el sitio está "up"
    } catch (err) {
      console.error('Error al verificar la URL:', err.message);
  
      let status = 500; // Estado por defecto en caso de error

 
      if (err.response) {
        console.log(err)
        status = err.response.status; // Estado HTTP del error si está disponible
      }  
  
      // Respuesta coherente para errores
      res.status(status).json({ response: 'down', status, message: err.message });
    }
  });

  app.post('/urls', async (req, res) => {
    try {
      const urls = req.body.urls; // Se espera un arreglo de URLs
  
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ response: 'URLs no proporcionadas o no es un arreglo', status: 400 });
      }


      
  
      // Crear un arreglo para almacenar los resultados
      const results = await Promise.all(
        urls.map(async (url) => {
          try {
            const findUrl = await axios.get(url); // Intentar obtener la URL

            let sslInfo = null;
          try {
            sslInfo = await sslChecker(url.replace(/^https?:\/\//, '')); // Eliminar el protocolo para ssl-checker
          } catch (sslError) {
            console.error(`Error obteniendo información SSL para la URL ${url}:`, sslError.message);
          }

          // Log de URL y fecha de expiración de SSL
          if (sslInfo) {
            console.log(`URL: ${url}, SSL Expiration Date: ${sslInfo.validTo}`);
          } else {
            console.log(`URL: ${url}, No SSL information available`);
          }


            return { url, response: 'up', status: findUrl.status, sslExpiration: sslInfo ? sslInfo.validTo : 'SSL no disponible' }; // Éxito
          } catch (err) {
            console.error(`Error con la URL ${url}:`, err.message);
            
            let status = 500; // Estado por defecto para errores
            if (err.response) {
              status = err.response.status; // Estado HTTP del error si está disponible
            }

    
            
            // Devuelve el estado y mensaje de error para la URL fallida
            return { url, response: 'down', status, message: err.message };
          }
        })
      );
  
      // Devuelve el resultado para cada URL
      res.status(200).json({ results });
    } catch (error) {
      res.status(500).json({ response: 'Error interno', status: 500, message: error.message });
    }
  });


  app.get('/getUrls', async (req, res) => {
    try {
      const results = await queryDatabase('SELECT * FROM url'); // Consulta SQL
  
      // Devolver resultados como JSON
      res.status(200).json({ results });
    } catch (err) {
      // Manejar errores
      console.error('Error al ejecutar consulta:', err);
  
      // Devolver respuesta con mensaje de error
      res.status(500).json({
        error: 'Error al obtener usuarios',
        details: err.message,
      });
    }
  });

// Función para ejecutar consultas SQL con promesas
const queryDatabase = (query) => {
    return new Promise((resolve, reject) => {
      connection.query(query, (err, results) => {
        if (err) {
          reject(err); // Rechazar la promesa si hay un error
        } else {
          resolve(results); // Resolver la promesa con resultados
        }
      });
    });
  };
  

  const insertUser = (user) => {
    return new Promise((resolve, reject) => {
      const query = 'INSERT INTO url (name) VALUES (?)'; // Consulta SQL para insertar
      const values = [user.name]; // Valores a insertar
  
      connection.query(query, values, (err, result) => {
        if (err) {
          reject(err); // Manejar error
        } else {
          resolve(result); // Devolver resultado de inserción
        }
      });
    });
  };


  app.post('/addUrl', async (req, res) => {
    try {
      const newUser = {
        name: req.body.url, 
      };
  
      const result = await insertUser(newUser); // Intentar insertar usuario
  
      // Devolver resultado como JSON
      res.status(200).json({ result });
    } catch (err) {
      console.error('Error al insertar usuario:', err.message);
  
      // Manejo de errores
      res.status(500).json({
        error: 'Error al insertar usuario',
        details: err.message,
      });
    }
  });

  const deleteUser = (userId) => {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM url WHERE id = ?'; // Consulta SQL para eliminar
      const values = [userId]; // Valor para eliminar según el ID
  
      connection.query(query, values, (err, result) => {
        if (err) {
          reject(err); // Si hay un error, rechazar la promesa
        } else {
          resolve(result); // Si tiene éxito, resolver la promesa
        }
      });
    });
  };

  app.delete('/deleteUrl/:id', async (req, res) => {
    try {
      const userId = req.params.id; // Obtener el ID del usuario a eliminar
  
      const result = await deleteUser(userId); // Eliminar usuario
  
      if (result.affectedRows === 0) { // Verificar si se eliminó un usuario
        return res.status(404).json({
          error: 'url no encontrado',
          status: 404,
        });
      }
  
      // Respuesta en caso de éxito
      res.status(200).json({ result });
    } catch (err) {
      console.error('Error al eliminar usuario:', err.message);
  
      // Manejar errores y devolver respuesta con detalles
      res.status(500).json({
        error: 'Error al eliminar usuario',
        status: 500,
        details: err.message,
      });
    }
  });

  const updateUser = (userId, updatedData) => {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE url SET name = ? WHERE id = ?'; // Consulta para actualizar
      const values = [updatedData.name, userId]; // Valores para actualizar y el ID del usuario
  
      connection.query(query, values, (err, result) => {
        if (err) {
          reject(err); // Manejar error
        } else {
          resolve(result); // Devolver el resultado de la operación
        }
      });
    });
  };

  // Endpoint para editar un usuario
app.put('/editUrl/:id', async (req, res) => {
    try {
      const userId = req.params.id; // ID del usuario a editar
      const updatedData = {
        name: req.body.name, // Nuevo nombre
        
      };
  
      const result = await updateUser(userId, updatedData); // Intentar actualizar usuario
  
      if (result.affectedRows === 0) {
        // Si no se afectaron filas, el usuario no se encontró
        return res.status(404).json({
          error: 'Usuario no encontrado',
          status: 404,
        });
      }
  
      // Respuesta de éxito
      res.status(200).json({ result });
    } catch (err) {
      console.error('Error al editar usuario:', err.message);
  
      // Manejo de errores
      res.status(500).json({
        error: 'Error al editar usuario',
        status: 500,
        details: err.message,
      });
    }
  });