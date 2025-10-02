function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.classList.remove('active')
  )
  document.querySelectorAll('.tab-content').forEach(content =>
    content.classList.remove('active')
  )
  document.getElementById(`tab-${tabName}`).classList.add('active')
  document.getElementById(`content-${tabName}`).classList.add('active')
}

function switchExample(exampleName) {
  document.querySelectorAll('.example-btn').forEach(btn =>
    btn.classList.remove('active')
  )
  document.querySelectorAll('.example-content').forEach(content =>
    content.classList.remove('active')
  )
  document.getElementById(`ex-${exampleName}`).classList.add('active')
  document.getElementById(`example-${exampleName}`).classList.add('active')
}

async function copyExample(exampleName) {
  const codeElement = document.querySelector(
    `#example-${exampleName} .code-content code`
  )
  const copyBtn = document.getElementById(`copy-${exampleName}`)
  if (!codeElement || !copyBtn) return

  const text = codeElement.textContent ?? ''

  try {
    await navigator.clipboard.writeText(text)
    copyBtn.textContent = 'Copied!'
    copyBtn.style.background = '#10b981'
    setTimeout(() => {
      copyBtn.textContent = 'Copy'
      copyBtn.style.background = ''
    }, 2000)
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    copyBtn.textContent = 'Copied!'
    setTimeout(() => {
      copyBtn.textContent = 'Copy'
      copyBtn.style.background = ''
    }, 2000)
  }
}

function showCliInstall() {
  const instructions = document.getElementById('cli-install')
  if (!instructions) return
  instructions.style.display =
    instructions.style.display === 'none' ? 'block' : 'none'
}

async function copyCliCommand() {
  const command = 'npx @pokerpocket/engine --seed 42'
  const copyBtn = document.getElementById('cli-copy-text')
  if (!copyBtn) return
  try {
    await navigator.clipboard.writeText(command)
    copyBtn.textContent = 'Copied!'
    setTimeout(() => {
      copyBtn.textContent = 'Copy'
    }, 2000)
  } catch {
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

async function copyCliQuickStart() {
  const command = 'npm install @pokerpocket/engine\nnpx @pokerpocket/engine --seed 42'
  const copyBtn = document.getElementById('copy-cli-quick')
  if (!copyBtn) return
  try {
    await navigator.clipboard.writeText(command)
    copyBtn.textContent = 'Copied!'
    setTimeout(() => {
      copyBtn.textContent = 'Copy'
    }, 2000)
  } catch {
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

function switchHeroTab(tabName) {
  document.querySelectorAll('.hero-tab').forEach(btn =>
    btn.classList.remove('active')
  )
  document.querySelectorAll('.hero-code-content').forEach(content =>
    content.classList.remove('active')
  )
  document.getElementById(`hero-${tabName}-tab`).classList.add('active')
  document.getElementById(`hero-${tabName}-content`).classList.add('active')
}

window.switchTab = switchTab
window.switchExample = switchExample
window.copyExample = copyExample
window.showCliInstall = showCliInstall
window.copyCliCommand = copyCliCommand
window.copyCliQuickStart = copyCliQuickStart
window.switchHeroTab = switchHeroTab
