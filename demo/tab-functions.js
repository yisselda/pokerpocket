// Tab switching functionality
function switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'))

    // Add active class to selected tab and content
    document.getElementById(`tab-${tabName}`).classList.add('active')
    document.getElementById(`content-${tabName}`).classList.add('active')
}

// Example switching functionality
function switchExample(exampleName) {
    // Remove active class from all example tabs and content
    document.querySelectorAll('.example-btn').forEach(btn => btn.classList.remove('active'))
    document.querySelectorAll('.example-content').forEach(content => content.classList.remove('active'))

    // Add active class to selected example tab and content
    document.getElementById(`ex-${exampleName}`).classList.add('active')
    document.getElementById(`example-${exampleName}`).classList.add('active')
}

// Copy example code functionality
async function copyExample(exampleName) {
    const codeElement = document.querySelector(`#example-${exampleName} .code-content code`)
    const copyBtn = document.getElementById(`copy-${exampleName}`)

    try {
        await navigator.clipboard.writeText(codeElement.textContent)

        // Visual feedback
        const originalText = copyBtn.textContent
        copyBtn.textContent = 'Copied!'
        copyBtn.style.background = '#10b981'

        // Reset after 2 seconds
        setTimeout(() => {
            copyBtn.textContent = originalText
            copyBtn.style.background = ''
        }, 2000)

    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = codeElement.textContent
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)

        copyBtn.textContent = 'Copied!'
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)
    }
}

// Show CLI install instructions
function showCliInstall() {
    const instructions = document.getElementById('cli-install')
    instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none'
}

// Copy CLI command
async function copyCliCommand() {
    const command = 'npx pokerpocket'
    const copyBtn = document.getElementById('cli-copy-text')

    try {
        await navigator.clipboard.writeText(command)

        // Visual feedback
        copyBtn.textContent = 'Copied!'

        // Reset after 2 seconds
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)

    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = command
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)

        copyBtn.textContent = 'Copied!'
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)
    }
}

// Export functions to global scope
window.switchTab = switchTab
window.switchExample = switchExample
window.copyExample = copyExample
window.showCliInstall = showCliInstall
window.copyCliCommand = copyCliCommand

// Copy CLI quick start command
async function copyCliQuickStart() {
    const command = 'npm install pokerpocket\nnpx pokerpocket'
    const copyBtn = document.getElementById('copy-cli-quick')

    try {
        await navigator.clipboard.writeText(command)

        // Visual feedback
        copyBtn.textContent = 'Copied!'

        // Reset after 2 seconds
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)

    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = command
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)

        copyBtn.textContent = 'Copied!'
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)
    }
}

window.copyCliQuickStart = copyCliQuickStart

// Hero tab switching functionality
function switchHeroTab(tabName) {
    // Remove active class from all hero tabs and content
    document.querySelectorAll('.hero-tab').forEach(btn => btn.classList.remove('active'))
    document.querySelectorAll('.hero-code-content').forEach(content => content.classList.remove('active'))

    // Add active class to selected hero tab and content
    document.getElementById(`hero-${tabName}-tab`).classList.add('active')
    document.getElementById(`hero-${tabName}-content`).classList.add('active')
}

window.switchHeroTab = switchHeroTab

// Copy installation command
async function copyInstallation() {
    const command = 'npm install pokerpocket'
    const copyBtn = document.getElementById('copy-install-text')

    try {
        await navigator.clipboard.writeText(command)

        // Visual feedback
        copyBtn.textContent = 'Copied!'

        // Reset after 2 seconds
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)

    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = command
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)

        copyBtn.textContent = 'Copied!'
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)
    }
}

// Copy basic usage code
async function copyBasicUsage() {
    const code = `import { newGame } from "pokerpocket";

const game = newGame({ players: 3 });
game.deal();
game.flop();
game.turn();
game.river();
const result = game.showdown();
console.log('Winner:', result.winners.map(w => \`P\${w + 1}\`));`

    const copyBtn = document.getElementById('copy-usage-text')

    try {
        await navigator.clipboard.writeText(code)

        // Visual feedback
        copyBtn.textContent = 'Copied!'

        // Reset after 2 seconds
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)

    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = code
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)

        copyBtn.textContent = 'Copied!'
        setTimeout(() => {
            copyBtn.textContent = 'Copy'
        }, 2000)
    }
}

window.copyInstallation = copyInstallation
window.copyBasicUsage = copyBasicUsage