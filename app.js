require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const date = require(__dirname + "/date.js");
const mongoose = require('mongoose');
const _ = require('lodash');

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static("public"));

//variável a ser usada em varios metodos. Retorna o dia de hoje
let today = date.getDate();

//Connect to a LOCAL MONGODB
mongoose.connect("mongodb://localhost:27017/todolistDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

//Connect to MONGODB ATLAS CLUSTER
// const username = process.env.MONGODBA_USER;
// const password = process.env.MONGODBA_PWD;
// const databaseName = process.env.MONGODBA_DBNAME;
// const clusterID = process.env.MONGODBA_CLUSTER_ID;
//
// mongoose.connect("mongodb+srv://" + username + ":" + password + "@" + clusterID + "/" + databaseName, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// });

//SCHEMA and MODEL usados para criar uma nova coleção para items
const itemSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'error: item not specified']
  }
});

const Item = mongoose.model('Item', itemSchema);


//Default items: serão adicionados a cada nova lista
const item1 = new Item({
  content: 'Welcome to your new list!'
});

const item2 = new Item({
  content: 'ADD items using the + sign!'
});

const item3 = new Item({
  content: '<-- CLICK here to REMOVE an item!'
});

const defaultItems = [item1, item2, item3];


//SCHEMA and MODEL usados para criar uma coleção para listas (e.g. Work List)
const listSchema = {
  name: String,
  items: [itemSchema]
};

const List = mongoose.model("List", listSchema);


//ROUTING

app.route("/")

  //Como evitar REPETIR items na homepage?
  .get((req, res) => {

    //1) O servidor procura por itens da homepage na DB
    Item.find(
      {},//filter: find ALL
      (err, foundItems) => {
      //2) Se a DB estiver vazia (1º load da homepage)...
      if (foundItems.length === 0) {
        //3) ...Adicionar os default items
        Item.insertMany(
          defaultItems,
          (err) => {
          //Handler se houver erros na adição de items a DB
          if (err) {
            console.log(err);
          } else {
            console.log("Success at inserting default items on DB");
          }
        });
        //4) Após adicionar, redirecionar para a homepage
        res.redirect('/');
        //5) Se a DB NAO estiver vazia (a partir do 2º load da homepage, inclusive)
      } else {
        //6) Carregar a homepage com os items presentes na DB
        res.render("list", {
          listTitle: today,
          newListItems: foundItems
        });
      }
    });
  })

  .post((req, res) => {

    /*permite criar/consultar uma lista utilizando o input*/
    const newListName = req.body.newList;

    if (newListName) {
      res.redirect("/" + newListName);
    } else {
      console.log("blank list not valid");
    }

    //Adicionar items a homepage e as listas criadas
    //1) Dados necessários: nome do item e titulo da lista
    const itemName = req.body.newItem;
    const listTitle = req.body.list;

    //2) Criação de um documento do tipo Item
    const itemToAdd = new Item({
      content: itemName,
    });
    //3) Caso estejamos na homepage, o item é adicionado a coleção items
    if (listTitle === today) {
      itemToAdd.save();
      res.redirect("/");
    //4) caso contrario (CC), o item sera adicionado a lista com o titulo recebido
    } else {
      List.findOne(
        {name: listTitle},//filter
        (err, foundList) => {
        if (!err) {
          if (foundList) {
            //5) Item é adicionado directamente ao array de items da lista
            foundList.items.push(itemToAdd);
            //6) é feito o update da lista na DB
            foundList.save();
            //7) redirect para a pagina da lista
            res.redirect("/" + listTitle);
          } else {
            console.log("error: list not found!");
          }
        }
      });
    }
  });


// Criar/Consultar listas
app.get("/:customListName", (req, res) => {
  //1) Garantir que o nome da lista é capitalizado
  const customListName = _.capitalize(req.params.customListName);
  //ATENÇAO: findOne(...) --> document  !=  find(...) --> array
  //2) Servidor procura por UMA lista com o nome introduzido na url
  List.findOne(
    {name: customListName},//filter
    (err, foundList) => {
    if (!err) {
      if (foundList) {
        //3) Caso a lista exista, é mostrada
        res.render("list", {
          listTitle: foundList.name,
          newListItems: foundList.items
        });
      } else {
        //4) Se a lista não existir, é criada
        const list = new List({
          name: customListName,
          items: defaultItems
        });
        //5) update da lista na DB
        list.save();
        //6) redirect para a página da lista
        res.redirect("/" + customListName);
      }
    }
  });
});


//Remover item de uma lista (delete one)
app.post("/delete", (req, res) => {
  //1) Dados necessários: nome do item e titulo da lista
  const itemToDelID = req.body.checkbox;
  const listTitle = req.body.listTitle;
  //2) Caso estejamos na homepage, o item é removido da coleção items
  if(listTitle === today){
    //method findByIdAndRemove: remove o item com o ID especificado
    //IMPORTANTE: este método DO NOT WORK without the callback
    Item.findByIdAndRemove(
      {_id: itemToDelID},//filter
      {useFindAndModify: false},//option
      (err) => {//callback
      if (!err) {
        res.redirect("/");
      }
    });
  //3) caso contrario (CC), o item sera removido da lista com o titulo recebido
  } else {
    //método findOneAndUpdate: evita loops e iterações desnecessárias sobre arrays de documentos
    List.findOneAndUpdate(
      {name: listTitle},//filter: identifica a lista
      {$pull: {items: {_id: itemToDelID}}}, //pull from an items array an item that has the id specified in the query
      {useFindAndModify: false},//option
      (err, foundList) => {
        if (!err) {
          res.redirect("/" + listTitle);
        }
      }
    );
  }
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port);
