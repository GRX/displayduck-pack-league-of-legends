<a id="readme-top"></a>

<div align="center">

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

</div>


<br />
<div align="center">
  <a href="https://developer.riotgames.com/docs/lol">
    <img src="img/ddxlol.png" alt="League of Legends logo" width="200" height="80">
  </a>

  <h3 align="center">DisplayDuck League of Legends Stats Pack</h3>

  <p align="center">
    Live League of Legends match stats for DisplayDuck.
  </p>
</div>

---

## About
This pack displays live League of Legends player and team stats using Riot's local Live Client Data API.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


## Getting Started
Install the pack in DisplayDuck and add the `LoL: Match stats` widget.

The widget polls League of Legends locally while a game is active. No Riot API key or account information is required.

The Live Client Data API is available automatically while League of Legends is running in an active game. The default endpoint is:

```text
https://127.0.0.1:2999/liveclientdata/allgamedata
```

If the widget shows `WAITING FOR GAME`, start or join a match and keep the League game client running. Changes to the API port can be made in the widget settings.


<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Configurable options
| Setting | Type | Configurable Values | Default Value
|---|---|---|---|
| Live API port | `number` | any port number | `2999`
| Poll interval (milliseconds) | `number` | `250`–`5000` | `1000`


<p align="right">(<a href="#readme-top">back to top</a>)</p>


## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contributors:

<a href="https://github.com/GRX/displayduck-league-of-legends/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=GRX/displayduck-league-of-legends" />
</a>


<p align="right">(<a href="#readme-top">back to top</a>)</p>


[contributors-shield]: https://img.shields.io/github/contributors/GRX/displayduck-league-of-legends.svg
[contributors-url]: https://github.com/GRX/displayduck-league-of-legends/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/GRX/displayduck-league-of-legends
[forks-url]: https://github.com/GRX/displayduck-league-of-legends/network/members
[stars-shield]: https://img.shields.io/github/stars/GRX/displayduck-league-of-legends
[stars-url]: https://github.com/othneildrew/Best-README-Template/stargazers
[issues-shield]: https://img.shields.io/github/issues/GRX/displayduck-league-of-legends
[issues-url]: https://github.com/GRX/displayduck-league-of-legends/issues
