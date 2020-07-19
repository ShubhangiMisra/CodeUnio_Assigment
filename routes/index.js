const uid = require('uid');
const queue = require('queue');

var express = require('express');
const { UpgradeRequired } = require('http-errors');
var router = express.Router();

let keys = {} //Global map of keys(UID) and thier status

function create_status(id) {
  return { key: id, blocked: false, last_blocked_on: null, last_ref_on: Date.now() };
}

function LinkedList() {
  this._head = this._tail = null;
}

LinkedList.prototype = {
  createNode: function (data, prev, next) {
    return {
      data: (data || null),
      prev: (prev || null),
      next: (next || null)
    };
  },

  addToHead: function (data) {
    var node = this.createNode(data);

    if (this._head === null) {
      this._head = this._tail = node;
    }
    else {
      node.next = this._head;
      this._head = node;
    }

    return this;
  },

  addToTail: function (data) {
    var node = this.createNode(data);
    node.prev = this._tail;
    if (this._head === null) {
      this._head = this._tail = node;
    }
    else {
      this._tail.next = node;
      this._tail = node;
    }

    return this;
  },

  deleteFromHead: function () {
    var data = null;

    if (this._head !== null) {
      // If the list only contains one node.
      if (this._head === this._tail) {
        // We save the data of the node we want to remove.
        data = this._head.data;
        // Then we remove the reference to that node.
        this._head = this._tail = null;
      }
      else {
        // We save the data of the node we want to remove.
        data = this._head.data;
        // Then we set the next node as the head. And the reference to
        // the old head is gone.
        this._head = this._head.next;
      }
    }

    return data;
  },

  deleteFromTail: function () {
    var data = null,
      head = this._head,
      tail = this._tail,
      tempNode;

    if (head !== null) {
      if (head === tail) {
        data = tail.data;

        this._head = this._tail = null;
      }
      else {
        data = tail.data;

        tempNode = this._tail.prev;
        this._tail = tempNode;
        this._tail.next = null;
      }
    }

    return data;
  },

  toArray: function () {
    var array = [],
      node = this._head;

    while (node) {
      array.push(node.data);
      node = node.next;
    }

    return array;
  },

  toString: function () {
    return this.toArray().join(' ,');
  }
}

function is_alive(key) {
  if ( (Date.now() - keys[key].last_ref_on <= 300000)) {
    return key;
  }
  else {
    delete keys[key];
    return null;
  }

}

let DLL = new LinkedList();
/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Special Server' });
});

router.get('/R1', function (req, res, next) {
  //x = {a: 'Keys Generated'}
  //res.render('index', { title: x['a'] });

  /* This End point generates an API KEY, store it our map and the head node of DLL which whose difference of current time and
  last blocked on is >= 60000 ms OR it 's last blocked is null
  */
  k = uid();
  keys[k] = create_status(k);
  DLL = DLL.addToHead(keys[k]);
  res.json({ result: 'New Key Generation - Success!', key: k });
  
});

router.get('/R2', function (req, res, next) {
  //res.render('index', { title: 'Available keys to get' });
  /*this which fetch the available key with the head node of DLL head(which whose difference of current time and
  last blocked on is >= 60000 ms OR it 's last blocked is null - active queue is mainted)*/
  if(DLL._head != null){
    k = DLL.deleteFromHead();
    //console.log(k);
    k = k.key;
    //console.log(k);
    if (is_alive(k) != null)
    { keys[k].blocked =true;
      keys[k].last_blocked_on = Date.now();
      DLL.addToTail(keys[k]);
    }
  
    if ((is_alive(k) != null)&& (keys[k].blocked && Date.now() - keys[k].last_blocked_on >= 60000)) {
      keys[k].last_blocked_on = Date.now();
      keys[k].blocked = true;
      DLL.addToHead(keys[k]);
      return res.json({ result: 'Key avilable', key: keys[k] });
    }
    return res.json({ result: 'Key avilable', key: keys[k] });
  
  }
  

  res.sendStatus(404);
});

router.get('/R3/:key', function (req, res, next) {
  //res.render('index', { title: 'Unblock keys' });
  let k = req.params.key;
  if (is_alive(k) != null) {
    keys[k].blocked = false;
    keys[k].last_blocked_on = null;
    DLL.addToHead(keys[k]);
    }
    if ((is_alive(k) != null)&& (keys[k].blocked && Date.now() - keys[k].last_blocked_on >= 60000)) {
      keys[k].last_blocked_on = Date.now();
      keys[k].blocked = false;
      DLL.addToHead(keys[k]);
    }

  res.json({ result: 'Key Released' });
});

router.get('/R4/:key', function (req, res, next) {
  //res.render('index', { title: 'Delete keys' });
  let key = req.params.key;
  if (keys[key]) {
    delete keys[key];
    res.json({ result: 'Key Deleted' });
  } else {
    res.status(400).json({ result: 'Key is not present' })
  }
});

router.get('/R5/:key', function (req, res, next) {
  //res.render('index', { title: 'Alive keys' });
  let key = req.params.key;
  
  if (is_alive(key) != null) {
    keys[key].last_ref_on = Date.now();
    if( (keys[key].blocked && Date.now() - keys[key].last_blocked_on >= 60000) || !keys[key].blocked)
    keys[key].blocked = false;
    keys[key].last_blocked_on = Date.now();
    DLL.addToHead(key);
  }
  else{
    return res.json({ result: 'Key was not Alived since 5 minutes hence deleted',key: key });
  }
  res.json({ result: 'Key Alive',key: key });
});

module.exports = router;
