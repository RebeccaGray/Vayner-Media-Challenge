'use strict';
const express = require('express');
const PORT = process.env.PORT || 3000;
const bodyParser = require('body-parser');
const fs = require('fs');
const h = require('./helpers');

const app = express();
app.use(bodyParser.json());

app.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});

const pfs = (filepath, enc) =>{
  return new Promise(function (resolve, reject){
    fs.readFile(filepath, enc, function (err, res){
      if (err) reject(err);
      else resolve(res);
    });
  })
}
//source1.csv
// [ 'campaign', 'date', 'spend', 'impressions', 'actions' ]
//[ campaign:'fish_cow_desert',
//  date: '2015-01-01',
//  spend: '10.98',
//  impressions: '1621',
//  actions: '[{"y": 47, "action": "conversions"}, {"action": "conversions", "b": 49}, {"action": "conversions", "z": 29}, {"a": 69, "action": "conversions"}, {"action": "conversions", "x": 81}]' ]    //    filter for actions.type == x ||y
//source2.csv
// [ 'campaign', 'object_type' ]
// [ 'valley_monkey_fruit',
//   'photo' ]

app.get('/costPerVideoView', (req,res) => {
  let promises = []
  promises.push(pfs('source1.csv','utf8'))
  promises.push(pfs('source2.csv','utf8'))
  Promise.all(promises)
  .then((data) => {
    const source1 = h.CSVToArray(data[0])
    const source2 = h.CSVToArray(data[1])
    source1.shift()
    source2.shift()
    let result = {}
    let totalViews = 0
    let totalSpend = 0
    source2.forEach((item) => {
      if(item[1] === 'video'){
        result[item[0]] = 0
      }
    })
    source1.forEach((item) => {
      if(result[item[0]] !== undefined){
        let spend = +item[2]
        let views = 0
        let actions = JSON.parse(item[4])
        actions.forEach((obj) => {
          if(obj['x'] !== undefined || obj['y'] !== undefined && obj['action'] === 'views'){
            views += obj['x'] !== undefined ?  obj['x'] : obj['y']
          }
        })
        totalViews += views
        totalSpend += spend
        //cpv = spend/views
        if(views === 0 || spend === 0)  result[item[0]] = 0
        else {result[item[0]] === undefined || result[item[0]] === NaN ? result[item[0]] = spend/views : result[item[0]] += spend/views}
     }
    })
    let average_cost_per_view = totalSpend/totalViews
    //total cost per video view ?  average, for each campaign, or sum of all campaigns?
    res.status(200).send(JSON.stringify([{average_cost_per_view : average_cost_per_view },result]))
  })
})

app.get('/campaignsPerMonth/:month', (req,res) => {
  let month = req.params.month
  pfs('source1.csv','utf8')
  .then((data) => {
    data = h.CSVToArray(data)
    data.shift()
    //unique is defined by campaign field
    let result = {}
    data.forEach((item)=>{
      let month = item[1].split('-')[1]
      if(month === '02' && result[item[0]] === undefined) result[item[0]] = 1;
    })
    res.status(200).send(JSON.stringify(Object.keys(result).length))
  })
})

app.get('/conversionsOnPlants', (req,res) => {
  pfs('source1.csv','utf8')
  .then((data) => {
    data = h.CSVToArray(data)
    data.shift()
    let conversions = 0
    data.forEach((item)=>{
      let plants = item[0].split('_')[0] === 'plants'
      if(plants) {
        let actions = JSON.parse(item[4])
        actions.forEach((obj)=>{
          if(obj['x'] !== undefined || obj['y'] !== undefined && obj['action'] === 'conversion'){
            conversions += obj['x'] !== undefined ?  obj['x'] : obj['y']
          }
        })
      }
    })
    res.status(200).send(JSON.stringify(conversions))
  })
})

app.get('/leastExpensiveConversions', (req,res) => {
  pfs('source1.csv','utf8')
  .then((data) => {
    data = h.CSVToArray(data)
    data.shift()
    data.pop()
    data.pop()
    let result = {}
    data.forEach((item)=>{
     if(item !== '' && item !== undefined){
      item[0].split('_').shift() //remove initiative from array
      // audience Asset Combination = item[0]
        let actions = JSON.parse(item[4])
        let conversions = 0
        let spend = item[2]
        actions.forEach((obj)=>{
          if(obj['x'] !== undefined || obj['y'] !== undefined && obj['action'] === 'conversion'){
            conversions += obj['x'] !== undefined ?  obj['x'] : obj['y']
          }
        })
        //cost per conversion  = spend / conversions
        if(conversions === 0 || +spend === 0) result[item[0]] = 0
        else {result[item[0]] === undefined || result[item[0]] === NaN ? result[item[0]] = +spend/conversions : result[item[0]] += +spend/conversions}
      }
     })
    let min, least
    let keys = Object.keys(result)
    keys.forEach((key)=>{
      if(min === undefined) min = result[key]
      if(result[key] < min && result[key] !== 0) {
        min = result[key]
        least = key
      }
    })
    res.status(200).send(JSON.stringify(least))
  })
})
