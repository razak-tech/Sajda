<h1 align="center">Sajda</h1>

<p align="center">
  <strong>Prayer times at the edge of your screen.</strong><br>
  Hover to see the next prayer and its live countdown. Sajda reminds you when it's time.<br>
  <sub>Open from the Windows notification area, or hover at the top, left, or right edge.</sub>
</p>

<p align="center">
  <a href="#install"><img src=".github/readme/install.png" width="322" alt="Build the Windows installer"></a>
  &nbsp;
  <a href="#preview"><img src=".github/readme/preview.png" width="322" alt="See the Sajda preview"></a>
</p>

<p align="center">
  <a href="#install"><img src=".github/readme/nav-install.png" width="106" alt="Install"></a>
  <a href="#preview"><img src=".github/readme/nav-preview.png" width="110" alt="Preview"></a>
  <a href="#features"><img src=".github/readme/nav-features.png" width="118" alt="Features"></a>
  <a href="#privacy"><img src=".github/readme/nav-privacy.png" width="110" alt="Privacy"></a>
  <a href="#build"><img src=".github/readme/nav-build.png" width="94" alt="Build"></a>
  <a href="UI-AND-USER-FLOW.md"><img src=".github/readme/nav-docs.png" width="86" alt="User guide"></a>
</p>

<p align="center">
  <img src=".github/readme/status-version.png" width="106" alt="Version 0.1.0">
  <img src=".github/readme/status-platform.png" width="119" alt="Platform Windows">
  <img src=".github/readme/status-languages.png" width="150" alt="Languages English and Arabic">
</p>

<blockquote>
  <p><strong>Offline use.</strong> Once Sajda has downloaded your city's prayer times, you can use the saved schedule offline while it still covers the current date.</p>
</blockquote>

<p align="center"><img src=".github/readme/divider.png" width="950" alt=""></p>

<h2>Why Sajda</h2>

<p>When you want to know how long remains until the next prayer, move your pointer to the screen edge. Sajda shows today's schedule and a countdown for your selected city.</p>

<table>
  <tr>
    <td width="33%" align="center" valign="top">
      <img src=".github/readme/card-location.png" width="50" alt=""><br>
      <strong>Choose your city</strong><br>
      <sub>Search by name and select your city to load its local prayer times.</sub>
    </td>
    <td width="33%" align="center" valign="top">
      <img src=".github/readme/card-edge.png" width="50" alt=""><br>
      <strong>Hover to check</strong><br>
      <sub>See all five daily prayers and how long remains until the next one.</sub>
    </td>
    <td width="33%" align="center" valign="top">
      <img src=".github/readme/card-reminder.png" width="50" alt=""><br>
      <strong>Get a reminder</strong><br>
      <sub>See an illustrated alert and choose Chime, Soft, or Silent.</sub>
    </td>
  </tr>
</table>

<a name="preview"></a>
<h2>Preview</h2>

<p>Sajda uses a different illustration for each prayer in the countdown and reminder cards. Here is the artwork for Maghrib.</p>

<p align="center"><img src="src/assets/prayer-maghrib-banner.webp" width="950" alt="Maghrib artwork from Sajda"></p>

<a name="features"></a>
<h2>Features</h2>

<ul>
  <li><strong>Daily schedule.</strong> See Fajr, Dhuhr, Asr, Maghrib, and Isha in your selected city's time zone.</li>
  <li><strong>Customizable screen edge.</strong> Pick the position, hover area, trigger thickness, and opening delay.</li>
  <li><strong>English and Arabic.</strong> Switch languages, with a right-to-left layout for Arabic.</li>
  <li><strong>Windows tray.</strong> Reopen Sajda from the notification area and choose whether it starts when you sign in.</li>
</ul>

<a name="install"></a>
<h2>Install on Windows</h2>

<p>Download the Windows x64 setup file from <a href="https://github.com/razak-tech/Sajda/releases">GitHub Releases</a>, or use the <a href="#build">build commands below</a> to generate it locally. The build writes the installer to <code>src-tauri/target/release/bundle/nsis/</code>.</p>

<a name="privacy"></a>
<h2>Privacy</h2>

<p>Sajda stores your preferences and cached prayer schedule locally. Open-Meteo supplies city search results, and AlAdhan supplies the prayer schedule for your selected coordinates and time zone. The optional approximate city lookup uses your public IP address.</p>

<a name="build"></a>
<h2>Build from source</h2>

<p>From the repository root on Windows, with the Tauri build prerequisites installed, run:</p>

<pre><code>npm ci
.\node_modules\.bin\tauri.cmd build --bundles nsis --ci</code></pre>

<p><a href="UI-AND-USER-FLOW.md">User guide and component map</a> · <a href="VERIFICATION.md">Windows verification</a></p>
