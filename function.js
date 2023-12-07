const axios = require('axios');

// Apikey
const apiKey = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjIzMjg3MzUyNCwiYWFpIjoxMSwidWlkIjoyMzUzNzM2NCwiaWFkIjoiMjAyMy0wMS0zMVQyMTowMjoxNy4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6OTUwNzUxNiwicmduIjoidXNlMSJ9.lX1RYu90B2JcH0QxITaF8ymd4d6dBes0FJHPI1mzSRE'; // Considera usar variables de entorno para mayor seguridad

// Función para obtener los datos de un item en Monday.com
async function getMondayItemData(itemId) {
    console.log(`Obteniendo datos del item con ID: ${itemId}`);
    const query = `query { items(ids: [${itemId}]) { column_values { id type value text } } }`;

    try {
        const response = await axios.post('https://api.monday.com/v2', {
            query: query
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Datos del item obtenidos con éxito:', response.data);
        return response.data.data.items[0].column_values;
    } catch (error) {
        console.error('Error al obtener datos del item:', error);
        throw error; // Lanza el error para manejarlo más arriba en la cadena
    }
}

// Función para crear un nuevo item en el otro tablero
async function createNewItemInOtherBoard(data) {
    console.log('Creando un nuevo item en el tablero:', data);

    // Asegúrate de que la fecha esté en el formato correcto "YYYY-MM-DD" o "YYYY-MM-DD HH:MM:SS"
    const fechaFormateada = data.fechaEmisionFactura.text; // Asegúrate de que este texto ya esté en el formato correcto

    const columnValues = {
        "texto46": data.numeroFactura.text,
        "cliente": data.nombreReceptorColumn.text,
        "rut": data.rutReceptorColumn.text,
        "mes_combinado": fechaFormateada, // Usar la fecha formateada como una cadena simple
        "monto_neto": data.montoNeto.toString(), // Convertir a string
        "estado_1": "Arriendo"
    };

    const columnValuesStr = JSON.stringify(columnValues);

    const mutation = `mutation {
        create_item(board_id: 1559353616, item_name: "${data.numeroFactura.text}", column_values: "${columnValuesStr.replace(/"/g, '\\"')}") {
            id
        }
    }`;

    try {
        const response = await axios.post('https://api.monday.com/v2', {
            query: mutation
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Nuevo item creado con éxito:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error al crear un nuevo item:', error);
        throw error;
    }
}


exports.otToFactura = async (req, res) => {
    try {
        console.log("Inicio de la función");

        if (!req.body || !req.body.event || !req.body.event.pulseId) {
            throw new Error('La solicitud no contiene la estructura esperada de un evento de Monday.com');
        }

        const itemId = req.body.event.pulseId;
        const columnsData = await getMondayItemData(itemId);

        // Procesamiento de los datos obtenidos
        const nombreReceptorColumn = columnsData.find(column => column.id === 'texto92');
        const rutReceptorColumn = columnsData.find(column => column.id === 'texto3');
        const fechaEmisionFactura = columnsData.find(column => column.id === 'fecha3');
        const valorArriendoColumn = columnsData.find(column => column.id === 'n_meros');
        const comisionRateColumn = columnsData.find(column => column.id === 'n_meros0');
        const gastoNotarialColumn = columnsData.find(column => column.id === 'n_meros9');
        const numeroFactura = columnsData.find(column => column.id === 'texto46');

        // Calcular montos y totales
        const valorArriendo = parseFloat(valorArriendoColumn.text);
        const comisionRate = parseFloat(comisionRateColumn.text) / 100;
        const gastoNotarial = parseFloat(gastoNotarialColumn.text);

        // Calculos
        const comisionArriendo = valorArriendo * comisionRate;
        const montoNeto = comisionArriendo + gastoNotarial;

        // Crear un nuevo item en otro tablero
        const newItemData = {
            numeroFactura,
            nombreReceptorColumn,
            rutReceptorColumn,
            fechaEmisionFactura,
            montoNeto,
        };
        await createNewItemInOtherBoard(newItemData);

        res.status(200).send("Item procesado y nuevo item creado correctamente");
    } catch (error) {
        console.error("Error en la función principal:", error.message);
        res.status(500).send("Error procesando el evento de Monday.com");
    }
};
