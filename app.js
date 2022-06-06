//  引入UDP包
const dgram = require('dgram');

//  创建DNS服务
const DNS_Server = dgram.createSocket('udp4')


const DNS_List = {
    "uair.cc":'127.0.0.1',
    "uair.top":'127.0.0.1',
    "togy.top":'127.0.0.1'
}


// The regular expression keyword in domain name.域名中的正则表达式关键字
const domain = /hursing/
// When keyword matched, resolve to this IP.
const targetIp = '127.0.0.1'
// When keyword not matched, use the fallback dns server to resolve.
const fallbackServer = '10.0.0.1'



//  消息转换
function copyBuffer(src, offset, dst) {
    for (let i = 0; i < src.length; ++i) {
        dst.writeUInt8(src.readUInt8(i), offset + i)
    }
}

//  返回DNS解析信息
function resolve(msg, rinfo, IP) {
    const queryInfo = msg.slice(12)
    const response = Buffer.alloc(28 + queryInfo.length)
    let offset = 0
    const id = msg.slice(0, 2)
    copyBuffer(id, 0, response)  // Transaction ID
    offset += id.length
    response.writeUInt16BE(0x8180, offset)  // Flags
    offset += 2
    response.writeUInt16BE(1, offset)  // Questions
    offset += 2
    response.writeUInt16BE(1, offset)  // Answer RRs
    offset += 2
    response.writeUInt32BE(0, offset)  // Authority RRs & Additional RRs
    offset += 4
    copyBuffer(queryInfo, offset, response)
    offset += queryInfo.length
    response.writeUInt16BE(0xC00C, offset)  // offset to domain name
    offset += 2
    const typeAndClass = msg.slice(msg.length - 4)
    copyBuffer(typeAndClass, offset, response)
    offset += typeAndClass.length
    response.writeUInt32BE(600, offset)  // TTL, in seconds
    offset += 4
    response.writeUInt16BE(4, offset)  // Length of IP
    offset += 2
    IP.split('.').forEach(value => {
        response.writeUInt8(parseInt(value), offset)
        offset += 1
    })
    // console.log(response.toString('hex'))

    DNS_Server.send(response, rinfo.port, rinfo.address, (err) => {
        if (err) {
            console.log(err)
            DNS_Server.close()
        }
    })
}

//  模拟发信
function forward(msg, rinfo) {
    const client = dgram.createSocket('udp4')
    client.on('error', (err) => {
        console.log(`client error:\n${err.stack}`)
        client.close()
    })
    client.on('message', (fbMsg, fbRinfo) => {
        DNS_Server.send(fbMsg, rinfo.port, rinfo.address, (err) => {
            err && console.log(err)
        })
        client.close()
    })
    client.send(msg, 53, fallbackServer, (err) => {
        if (err) {
            console.log(err)
            client.close()
        }
    })
}

//  格式化请求的域名
function parseHost(msg) {
    let num = msg.readUInt8(0)
    let offset = 1
    let host = ""
    while (num !== 0) {
        host += msg.slice(offset, offset + num).toString()
        offset += num
        num = msg.readUInt8(offset)
        offset += 1
        if (num !== 0) {
            host += '.'
        }
    }
    return host
}

DNS_Server.on('message', (msg, rinfo) => {
    // console.log(msg.toString('hex'))
    const host = parseHost(msg.slice(12))
    console.log(`receive query: ${host}`)
    if(Object.keys(DNS_List).indexOf(host) > -1){
        resolve(msg, rinfo, DNS_List[host])
    }else{
        forward(msg, rinfo)
    }
    // if (domain.test(host)) {
    //     resolve(msg, rinfo)
    // } else {
    //     forward(msg, rinfo)
    // }
})

DNS_Server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`)
    DNS_Server.close()
})

DNS_Server.on('listening', () => {
    const address = DNS_Server.address()
    console.log(`server listening ${address.address}:${address.port}`)
})

// On linux or Mac, run node with sudo. Because port 53 is lower then 1024.
DNS_Server.bind(53)