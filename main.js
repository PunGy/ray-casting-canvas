const SCREEN_RATIO = 4 / 3

const PIXEL_SIZE = 4

const DISPLAY_WIDTH = 768
const DISPLAY_HEIGHT = DISPLAY_WIDTH / SCREEN_RATIO

const SCREEN_WIDTH = DISPLAY_WIDTH / PIXEL_SIZE // Represented in pixel with accordings to PIXEL_SIZE
const SCREEN_HEIGHT = SCREEN_WIDTH / SCREEN_RATIO

const MAP_WIDTH = 32
const MAP_HEIGHT = 32

let player = {
    x: 2,
    y: 2,
    angle: 1, // camera angle in radians
}

const depth = 30 // Max distance
const FOV = Math.PI / 4 // View angle
const walkSpeed = 5
const turnSpeed = 2

const screenEl = document.getElementById('screen')
const context = screenEl.getContext('2d', { alpha: false })

screenEl.width = DISPLAY_WIDTH
screenEl.height = DISPLAY_HEIGHT

const map = `\
############....################\
#...............................\
#.......############....########\
#..............................#\
#..............##......##......#\
#......#####...##......#####...#\
#..............................#\
###............####............#\
##.............###.............#\
#......####..####......####..###\
#......#.......##......#.......#\
#......#.......##......#.......#\
#......#.......................#\
#......##########......#########\
#...............#..............#\
#...............#..............#\
############....############...#\
#...............#..............#\
#.......#########............###\
#..............##......##......#\
#......##......##......##......#\
#......#####...##......##.######\
#..............##..............#\
###............................#\
##.............###.............#\
#......##########......####..###\
#......#.......................#\
#......#.......##..............#\
#..............................#\
#......##########......#######.#\
#..............##..............#\
################################\
`.split('')

let tp1 = Date.now()
let deltaT = 0

let fillStyle = ''
let paintStack = 1
let prevXY = { x: 0, y: 0 }
const drawPixel = (x, y, color, forcePaint = false) => {
    if (fillStyle !== color || x !== prevXY.x) {
        context.fillStyle = fillStyle === '' ? color : fillStyle
        context.fillRect(f_int(prevXY.x * PIXEL_SIZE), f_int(prevXY.y * PIXEL_SIZE), PIXEL_SIZE, PIXEL_SIZE * paintStack)
        
        fillStyle = color
        paintStack = 1
        prevXY.x = x
        prevXY.y = y
    } else {
        paintStack++
    }
}

const stepForward = (player, walkSpeed, deltaT) => {
    player.x += Math.sin(player.angle) * walkSpeed * deltaT
    player.y += Math.cos(player.angle) * walkSpeed * deltaT
}
const stepBack = (player, walkSpeed, deltaT) => {
    player.x -= Math.sin(player.angle) * walkSpeed * deltaT
    player.y -= Math.cos(player.angle) * walkSpeed * deltaT
}

const KeyMap = {
    KeyW: 'Forward',
    KeyA: 'Left',
    KeyD: 'Right',
    KeyS: 'Back',
}
let pressedKey = Object.keys(KeyMap).reduce((keys, key) => {
    keys[key] = false
    return keys
}, {})
window.addEventListener('keydown', ({ code }) => {
    pressedKey[code] = true
})
window.addEventListener('keyup', ({ code }) => {
    pressedKey[code] = false
})

async function gameloop(timestamp) {
    deltaT = (timestamp - tp1) / 1000
    tp1 = timestamp

    for (let key in pressedKey) {
        if (pressedKey[key]) {
            switch (KeyMap[key]) {
                case 'Forward':
                    stepForward(player, walkSpeed, deltaT)
                    
                    // Handle collition
                    if (map[f_int(player.x) * MAP_WIDTH + f_int(player.y)] === '#') {
                        stepBack(player, walkSpeed, deltaT)
                    }
                    break
        
                case 'Left':
                    player.angle -= turnSpeed * deltaT
                    break
        
                case 'Right':
                    player.angle += turnSpeed * deltaT
                    break
        
                case 'Back':
                    stepBack(player, walkSpeed, deltaT)
                    
                    // Handle collition
                    if (map[f_int(player.x) * MAP_WIDTH + f_int(player.y)] === '#') {
                        stepForward(player, walkSpeed, deltaT)
                    }
                    break
            }
        }
    }

    for (let x = 0; x < SCREEN_WIDTH; x++) {
        // For each column, calculate the projected ray angle into world space
        const rayAngle = (player.angle - FOV / 2) + (x / SCREEN_WIDTH) * FOV

        const stepSize = 0.1
        let distanceToWall = 0

        let hitWall = false
        let boundary = false // Set when hits boundary between two wall blocks

        let eyeX = Math.sin(rayAngle) // unit vector for array in player space
        let eyeY = Math.cos(rayAngle)

        while (!hitWall && distanceToWall < depth) {
            distanceToWall += stepSize
            let testX = f_int(player.x + eyeX * distanceToWall)
            let testY = f_int(player.y + eyeY * distanceToWall)

            // If out of the map
            if (testX < 0 || testX >= MAP_WIDTH || testY < 0 || testY >= MAP_HEIGHT) {
                hitWall = true
                distanceToWall = depth // just set distance to maximum
            } else if (map[testX * MAP_WIDTH + testY] === '#') {
                hitWall = true

                const p = []

                for (let tx = 0; tx < 2; tx++) {
                    for (let ty = 0; ty < 2; ty++) {
                        let vx = testX + tx - player.x
                        let vy = testY + ty - player.y

                        let d = Math.sqrt(vx**2 + vy**2)
                        let dot = (eyeX * vx / d) + (eyeY * vy / d)

                        p.push([d, dot])
                    }
                }
                
                p.sort((a, b) => a[0] - b[0])

                let bound = 0.004
                if (p.slice(0, 2).some(pp => Math.acos(pp[1]) < bound)) {
                    boundary = true
                }
            }
        }

        let ceiling = SCREEN_HEIGHT / 2 - SCREEN_HEIGHT / distanceToWall
        let floor = SCREEN_HEIGHT - ceiling
        let shadeLevel = 0

        for (let y = 0; y < SCREEN_HEIGHT; y++) {
            if (y <= ceiling) {
                const dist = 1 + (y - SCREEN_HEIGHT / 2) / (SCREEN_HEIGHT / 2)
                if (dist < 0.25) shadeLevel = 0
                else if (dist <= 0.5) shadeLevel = -0.4
                else if (dist <= 0.75) shadeLevel = -0.6
                else if (dist <= 0.9) shadeLevel = -0.8
                else shadeLevel = -0.95

                drawPixel(x, y, pSBC(shadeLevel, '#d8cd00')) // Draw ceil

            }
            else if (y > ceiling && y <= floor) {
                if (boundary) shadeLevel = -1
                else if (distanceToWall <= depth / 4) shadeLevel = 0
                else if (distanceToWall <= depth / 3) shadeLevel = -0.4
                else if (distanceToWall <= depth / 2) shadeLevel = -0.6
                else if (distanceToWall <= depth / 1.5) shadeLevel = -0.8
                else shadeLevel = -0.95
        
                drawPixel(x, y, pSBC(shadeLevel, '#0069db')) // Draw wall
                
            }
            else {
                const dist = 1 - (y - SCREEN_HEIGHT / 2) / (SCREEN_HEIGHT / 2)
                if (dist < 0.25) shadeLevel = 0
                else if (dist <= 0.5) shadeLevel = -0.4
                else if (dist <= 0.75) shadeLevel = -0.6
                else if (dist <= 0.9) shadeLevel = -0.8
                else shadeLevel = -0.95

                drawPixel(x, y, pSBC(shadeLevel, '#c61b1b'))

            }
        }
    }

    context.save()

    const mapPixelSize = 4
    let offset = 16

    context.fillStyle = '#e2e2e2'
    context.fillRect(0, offset, MAP_WIDTH * mapPixelSize, MAP_HEIGHT * mapPixelSize)
    map.forEach((char, i) => {
        if (char === '#') {
            context.fillStyle = '#595959'
            context.fillRect((i % MAP_WIDTH) * mapPixelSize, offset, mapPixelSize, mapPixelSize)
        }
        if (f_int(player.x) * MAP_WIDTH + f_int(player.y) === i) {
            context.save()
            context.fillStyle = '#c61b1b'


            const hc = ((i % MAP_WIDTH) * mapPixelSize) + mapPixelSize / 2
            const vc = offset + mapPixelSize / 2
            context.translate(hc, vc)
            context.rotate(player.angle)
            context.translate(-hc, -vc)
            
            
            context.fillRect((i % MAP_WIDTH) * mapPixelSize, offset, mapPixelSize, mapPixelSize)
            context.restore()
        }

        if (i % MAP_WIDTH === MAP_WIDTH - 1)
            offset += mapPixelSize
    })

    context.font = '16px serif'
    context.fillStyle = '#fff'
    context.fillText(`x: ${player.x.toFixed(1)}, y: ${player.y.toFixed(1)}, angle: ${player.angle.toFixed(2)}; FPS: ${(1 / deltaT).toFixed(2)} p/s`, 0, 14)

    context.restore()

    window.requestAnimationFrame(gameloop)
}

window.requestAnimationFrame(gameloop)

