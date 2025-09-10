var start_timer_seconds = 120;
var current_timer;

var timer_complete_interval;
var interval;
var timer_paused;
var timer_is_complete = 0;
var input_minutes = "";
var timer_complete_count = 0;
var overtime_seconds = 0;

var default_background_color = "";
var default_foreground_color = "rgb(0,0,0)";
var alt_background_color = "rgb(255, 0, 0)";
var alt_foreground_color = "rgb(100, 100, 100)";

// --- Gamification variables and logic ---
var points_today = 0;
var daily_points_threshold = 100;
var points_interval = null;
var points_timeout = null;
var points_award_remaining_ms = 60000;
var points_last_award_time = null;
var is_task_timer_running = false;
var show_scoring = true;

function get_today_date_string() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// For testing purposes - allows simulating different dates
function get_test_date_string(date) {
  if (date) {
    return date.toISOString().split('T')[0];
  }
  return get_today_date_string();
}

// Test function to verify midnight reset logic
function test_midnight_reset() {
  console.log('=== Testing Midnight Reset Logic ===');
  
  // Save current state
  const original_points = points_today;
  const original_last_award_time = points_last_award_time;
  
  // Simulate having points from yesterday
  points_today = 50;
  points_last_award_time = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime(); // Yesterday
  
  console.log('Before reset - points_today:', points_today);
  console.log('Before reset - last_award_time:', new Date(points_last_award_time));
  
  // Call award_point which should detect date change and reset
  award_point();
  
  console.log('After reset - points_today:', points_today);
  console.log('After reset - last_award_time:', new Date(points_last_award_time));
  
  // Restore original state
  points_today = original_points;
  points_last_award_time = original_last_award_time;
  
  console.log('=== Test Complete ===');
}

function save_gamification_data() {
  const today = get_today_date_string();
  let data = JSON.parse(localStorage.getItem('gamification_data') || '{}');
  if (!data.daily_points) data.daily_points = {};
  data.daily_points[today] = points_today;
  data.daily_points_threshold = daily_points_threshold;
  localStorage.setItem('gamification_data', JSON.stringify(data));
}

function restore_gamification_data() {
  const today = get_today_date_string();
  let data = JSON.parse(localStorage.getItem('gamification_data') || '{}');
  // If the last stored date is not today, reset points_today
  if (!data.daily_points) data.daily_points = {};
  if (!data.daily_points[today]) {
    points_today = 0;
    data.daily_points[today] = 0;
    localStorage.setItem('gamification_data', JSON.stringify(data));
  } else {
    points_today = data.daily_points[today];
  }
  daily_points_threshold = data.daily_points_threshold || 100;
  update_gamification_panel();
  schedule_midnight_points_reset();
}

// Schedule a timer to reset points_today at the next local midnight
function schedule_midnight_points_reset() {
  if (window._midnight_points_reset_timeout) {
    clearTimeout(window._midnight_points_reset_timeout);
  }
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const msUntilMidnight = nextMidnight - now;
  
  console.log(`Scheduling midnight reset in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
  
  window._midnight_points_reset_timeout = setTimeout(() => {
    console.log('Midnight reached - resetting points for new day');
    reset_points_for_new_day();
    schedule_midnight_points_reset(); // Schedule again for the next day
  }, msUntilMidnight + 1000); // Add 1s buffer
}

function reset_points_for_new_day() {
  console.log(`Resetting points for new day. Previous points: ${points_today}`);
  points_today = 0;
  save_gamification_data();
  update_gamification_panel();
  console.log('Points reset complete');
}

function calculate_streak() {
  let data = JSON.parse(localStorage.getItem('gamification_data') || '{}');
  let daily_points = data.daily_points || {};
  let streak = 0;
  let d = new Date();
  let today_str = d.toISOString().split('T')[0];
  // If today hasn't reached the threshold, start from yesterday
  if ((daily_points[today_str] || 0) < daily_points_threshold) {
    d.setDate(d.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    let ds = d.toISOString().split('T')[0];
    if ((daily_points[ds] || 0) >= daily_points_threshold) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function update_gamification_panel() {
  const points_display = document.getElementById('points-display');
  const streak_display = document.getElementById('streak-display');
  const gamification_panel = document.getElementById('gamification-panel');
  if (typeof show_scoring === 'undefined') show_scoring = true;
  if (gamification_panel) {
    gamification_panel.style.display = show_scoring ? 'block' : 'none';
  }
  if (!show_scoring) return;
  if (points_display) {
    let text = `Today: ${points_today} pts`;
    if (is_task_timer_running && !timer_paused && timer_is_complete === 0) text += ' ⚡';
    points_display.innerText = text;
  }
  if (streak_display) {
    streak_display.innerText = `🔥 ${calculate_streak()} day streak`;
  }
}

function award_point() {
  console.log('award_point called', {is_task_timer_running, timer_paused, timer_is_complete});
  
  // Check if the date has changed since we last awarded a point
  const current_date = get_today_date_string();
  if (points_last_award_time) {
    const last_award_date = new Date(points_last_award_time).toISOString().split('T')[0];
    if (current_date !== last_award_date) {
      // Date has changed, reset points for new day
      console.log(`Date changed from ${last_award_date} to ${current_date}, resetting points`);
      reset_points_for_new_day();
    }
  }
  
  if (is_task_timer_running && !timer_paused && timer_is_complete === 0) {
    points_today++;
    save_gamification_data();
    update_gamification_panel();
    console.log('Point awarded. points_today:', points_today);
    points_last_award_time = Date.now();
    points_award_remaining_ms = 60000;
  }
}

function start_points_tracking() {
  if (points_interval || points_timeout) return; // Only start if not already running
  console.log('start_points_tracking called');
  
  // Check if the date has changed since we last tracked points
  const current_date = get_today_date_string();
  if (points_last_award_time) {
    const last_award_date = new Date(points_last_award_time).toISOString().split('T')[0];
    if (current_date !== last_award_date) {
      // Date has changed, reset points for new day
      console.log(`Date changed from ${last_award_date} to ${current_date}, resetting points in start_points_tracking`);
      reset_points_for_new_day();
    }
  }
  
  // If resuming, use the remaining ms, otherwise start fresh
  if (points_award_remaining_ms < 60000) {
    points_timeout = setTimeout(function() {
      award_point();
      points_timeout = null;
      points_interval = setInterval(award_point, 60000);
    }, points_award_remaining_ms);
  } else {
    points_last_award_time = Date.now();
    points_interval = setInterval(award_point, 60000);
  }
}

function stop_points_tracking() {
  if (points_interval) {
    clearInterval(points_interval);
    points_interval = null;
    console.log('stop_points_tracking called (interval)');
  }
  if (points_timeout) {
    clearTimeout(points_timeout);
    points_timeout = null;
    console.log('stop_points_tracking called (timeout)');
  }
  // Calculate remaining ms until next point
  if (points_last_award_time) {
    var elapsed = Date.now() - points_last_award_time;
    points_award_remaining_ms = Math.max(60000 - elapsed, 1);
  } else {
    points_award_remaining_ms = 60000;
  }
}

function toggle_colors(target, prop, color1, color2) {
  current_val = document.querySelector(target).style[prop];

  if (current_val != color1) {
    document.querySelector(target).style[prop] = color1;
  } else {
    document.querySelector(target).style[prop] = color2;
  }
}

function update_fill() {
  var percent = 1 - current_timer / start_timer_seconds;
  document.querySelector("#fill").style["width"] = percent * 100 + "%";
  if (percent == 1) {
    document.querySelector("#fill").style["display"] = "none";
  } else {
    document.querySelector("#fill").style["display"] = "block";
  }
}

function timer_complete() {
  clearInterval(interval);
  timer_is_complete = 1;
  overtime_seconds = 0;
  stop_points_tracking();
  is_task_timer_running = false;

  if (play_audio_on_complete) {
    var audio;
    if (custom_audio_file) {
      // Use custom audio file if available
      audio = new Audio(custom_audio_file);
    } else {
      // Fall back to default ding.mp3
      audio = new Audio("ding.mp3");
    }
    audio.play();
  }

  timer_complete_interval = setInterval(function () {
    // Increment overtime counter
    overtime_seconds++;
    
    // Update timer display with negative time
    update_timer(-overtime_seconds);
    
    // Continue flashing behavior
    toggle_colors(
      "#timer",
      "background",
      alt_background_color,
      default_foreground_color,
    );
    toggle_colors(
      "#timer-value",
      "color",
      default_background_color,
      alt_foreground_color,
    );
    toggle_colors(
      "#timer-description",
      "color",
      alt_foreground_color,
      alt_foreground_color,
    );
    if (timer_complete_count % 2 == 0) {
      document.title = "-----";
    } else {
      document.title = "DONE!";
    }
    timer_complete_count++;
  }, 1000);
}

function str_pad_left(string, pad, length) {
  return (new Array(length + 1).join(pad) + string).slice(-length);
}

function format_time(seconds) {
  var is_negative = seconds < 0;
  var abs_seconds = Math.abs(seconds);
  var minutes = Math.floor(abs_seconds / 60);
  var seconds_remaining = abs_seconds % 60;
  var prefix = is_negative ? "-" : "";
  
  if (minutes > 99) {
    var final_time =
      prefix +
      str_pad_left(minutes, "0", 3) +
      ":" +
      str_pad_left(seconds_remaining, "0", 2);
  } else {
    var final_time =
      prefix +
      str_pad_left(minutes, "0", 2) +
      ":" +
      str_pad_left(seconds_remaining, "0", 2);
  }
  return final_time;
}

function fitTextToContainer(elementId, minFontSize = 12, maxFontSize = 48) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const parent = el.parentElement;
  if (!parent) return;

  let fontSize = maxFontSize;
  el.style.fontSize = fontSize + "px";
  el.style.whiteSpace = "normal";
  el.style.height = "auto";

  // Estimate line height as 1.2em
  let maxHeight = 2 * fontSize * 1.2;

  while (
    (el.scrollWidth > parent.clientWidth || el.offsetHeight > maxHeight) &&
    fontSize > minFontSize
  ) {
    fontSize -= 1;
    el.style.fontSize = fontSize + "px";
    maxHeight = 2 * fontSize * 1.2;
    el.style.height = "auto";
  }
}

function set_timer(minutes, description) {
  start_timer_seconds = minutes * 60;
  current_timer = start_timer_seconds;
  overtime_seconds = 0;

  // Only save config if this is not a task timer (i.e., it's a manual timer)
  // For task timers, we don't want to overwrite the default timer length
  if (!description) {
    save_config();
  }

  // if timer/task description is set, then config the display and start points tracking
  if (description) {
    console.log("setting description", description);
    timer_description_text = description;

    // Dynamically fit font size to container
    document.getElementById("timer-description").innerText = timer_description_text;
    fitTextToContainer("timer-description");
  } else {
    // this is not a task timer, so stop points tracking and reset the timer
    task_description = "";
    timer_description_text = "";
    stop_points_tracking();
    is_task_timer_running = false;
  }

  document.getElementById("timer-description").innerText = timer_description_text;

  start_timer();
  timer_is_complete = 0;
}

function reset_and_restart_timer() {
  reset_timer();
  start_timer();
}

function reset_timer() {
  clearInterval(timer_complete_interval);
  clearInterval(interval);

  document.querySelector("#timer").style["background"] =
    default_background_color;
  document.querySelector("#timer-value").style["color"] =
    default_foreground_color;

  current_timer = start_timer_seconds;
  overtime_seconds = 0;
  update_timer(current_timer);
  timer_is_complete = 0;
}

function show_input_minutes() {
  document.querySelector("#input-minutes").innerHTML = input_minutes + " mins";
  document.querySelector("#input-minutes").style.display = "flex";
}

function open_config() {
  // store the window size and location so we can restore it after the user is done with the config view
  save_current_window_size();

  // resize the window
  var width = 400;
  var height = 600;
  window.resizeTo(width, height);

  // show the config div
  document.querySelector("#config").style.display = "block";

  config_is_showing = 1;
}

function close_config() {
  // save the config data
  save_config();

  // hide the config div
  document.querySelector("#config").style.display = "none";

  // retrieve the stored, previous window size an x/y and restore the window to this size
  window.resizeTo(window_width, window_height);
  window.moveTo(window_x, window_y);

  config_is_showing = 0;
}

function save_current_window_size() {
  window_height = window.outerHeight;
  window_width = window.outerWidth;
  window_x = window.screenLeft;
  window_y = window.screenTop;
}

function open_task() {
  // store the window size and location so we can restore it after the user is done with the config view
  save_current_window_size();

  // resize the window
  var width = 420;
  var height = 400;
  window.resizeTo(width, height);

  // show the config div
  document.querySelector("#task-list").style.display = "block";

  // select the add task field
  document.getElementById("new_task_input").focus();

  task_is_showing = 1;
}

function close_task() {
  // save the config data
  save_config();

  // hide the config div
  document.querySelector("#task-list").style.display = "none";

  // retrieve the stored, previous window size an x/y and restore the window to this size
  window.resizeTo(window_width, window_height);
  window.moveTo(window_x, window_y);

  task_is_showing = 0;
}

function catch_onkeydown(e) {
  if (e.key == "Escape") {
    if (config_is_showing) {
      close_config();
    }
    if (task_is_showing) {
      close_task();
    }
    // Exit timer input mode if currently entering minutes
    if (input_minutes !== "") {
      input_minutes = "";
      document.querySelector("#input-minutes").style.display = "none";
      // Restart timer since we paused it when entering input mode
      if (!timer_paused && timer_is_complete === 0) {
        start_timer();
      }
    }
  }
  
  // Handle backspace for timer input
  if (e.key == "Backspace" && input_minutes !== "") {
    input_minutes = input_minutes.slice(0, -1);
    if (input_minutes === "") {
      // If backspace removes the last character, exit timer input mode
      document.querySelector("#input-minutes").style.display = "none";
      // Restart timer since we paused it when entering input mode
      if (!timer_paused && timer_is_complete === 0) {
        start_timer();
      }
    } else {
      // Update the display with remaining characters
      show_input_minutes();
    }
  }
}

function catch_keypress(e) {
  // while task list is showing, ignore (most) key catching
  if (task_is_showing) {
    return true;
  }

  // while config is showing, ignore keyboard shortcuts to allow normal form input
  if (config_is_showing) {
    return true;
  }

  // reset current timer
  if (e.key == "r" || e.key == "R") {
    reset_and_restart_timer();
  }

  // pause current timer
  if (e.key == "p" || e.key == "P" || e.code === "Space") {
    if (timer_paused) {
      start_timer();
    } else {
      pause_timer();
    }
  }

  // start new timer
  if (e.key == "Enter" || e.key == "Return") {
    set_timer(input_minutes);
    reset_and_restart_timer();
    document.querySelector("#input-minutes").style.display = "none";
    input_minutes = "";
  }

  // set new timer
  var set_timer_keys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  if (set_timer_keys.indexOf(e.key) != -1) {
    clearInterval(interval);
    input_minutes += e.key;
    show_input_minutes();
  }

  // set test timer
  if (e.key == "^") {
    clearInterval(interval);
    input_minutes += 0.1;
    show_input_minutes();
  }

  // toggle config mode
  var open_config_keys = ["?"];
  if (open_config_keys.indexOf(e.key) != -1) {
    if (config_is_showing) {
      close_config();
    } else {
      open_config();
    }
  }

  // toggle task mode
  var task_keys = ["t", "T"];
  if (task_keys.indexOf(e.key) != -1) {
    if (task_is_showing) {
      close_task();
    } else {
      open_task();
    }
  }

  // mark task complete and begin next task
  if (e.key == ">") {
    next_task();
  }

  e.preventDefault();
}

function next_task() {
  console.log("task_description", task_description);

  // find the current task by matching the description text to the item in the task list
  var current_task_description = document.querySelector(
    "#tasks .task .start[description='" + task_description + "']",
  );
  if (current_task_description) {
    var current_task = current_task_description.parentNode;
  }

  if (current_task) {
    console.log("current task", current_task);
    // find the next task in the list
    var next_task = current_task.nextElementSibling;
    console.log("next task", next_task);

    if (next_task) {
      // start the next task
      start_timer_from_task(next_task.querySelector(".start"));
    } else {
      // no more tasks, so take the user to the task list and display a message
      open_task();

      // show and then fade out the toast message
      var toast = document.getElementById('toast');
      toast.style.display = "block";
      toast.style.opacity = "1";
      setTimeout(function () {
        toast.style.opacity = "0";
        setTimeout(function () {
          toast.style.display = "none";
        }, 1000); // Match this duration with the CSS transition duration
      }, 2000);
    }

    // remove the current task from the task list and remove it from localStorage
    remove_task(current_task.querySelector(".remove"));
  }
}

function update_timer(seconds) {
  var timer_value = document.getElementById("timer-value");
  timer_value.innerHTML = format_time(seconds);
  document.title = format_time(seconds);
  update_fill();
  update_gamification_panel();
  update_control_buttons();
}

function update_control_buttons() {
  const playPauseBtn = document.getElementById("play-pause-btn");
  if (playPauseBtn) {
    if (timer_paused) {
      playPauseBtn.innerHTML = "▶️";
      playPauseBtn.title = "Resume (Space)";
    } else {
      playPauseBtn.innerHTML = "⏸️";
      playPauseBtn.title = "Pause (Space)";
    }
  }
}

function countdown() {
  if (current_timer === 0) {
    timer_complete();
    return;
  }
  if (!current_timer) {
    current_timer = start_timer_seconds;
  }
  current_timer--;
  update_timer(current_timer);
}

function start_timer() {
  clearInterval(interval);
  interval = setInterval(function () {
    countdown();
  }, 1000);
  document.querySelector("#paused-message").style.display = "none";
  timer_paused = false;
  document.querySelector("#timer").classList.remove("paused");
  update_control_buttons();
  // Always resume points tracking if this is a task timer and timer is not complete
  if (is_task_timer_running && timer_is_complete === 0) start_points_tracking();
}

function pause_timer() {
  clearInterval(interval);
  document.querySelector("#paused-message").style.display = "flex";
  timer_paused = true;
  document.querySelector("#timer").classList.add("paused");
  update_control_buttons();
  stop_points_tracking();
  // if the timer has completed and user pauses it, assume they want to reset it as well
  if (timer_is_complete == 1) {
    reset_timer();
  }
}

function toggle_audio(audio_checkbox) {
  if (audio_checkbox.checked == true) {
    play_audio_on_complete = true;
  } else {
    play_audio_on_complete = false;
  }
}

function handle_custom_audio(file_input) {
  if (file_input.files && file_input.files[0]) {
    var file = file_input.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
      custom_audio_file = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    custom_audio_file = null;
  }
}

function change_bgcolor(color_input) {
  if (
    color_input.length > 0 &&
    color_input.length <= 7 &&
    color_input.substring(0, 1) == "#"
  ) {
    document.getElementById("fill").style.background = color_input;
  }
}

function restore_config() {
  // read data from localstorage and restore form values
  var config = JSON.parse(localStorage.getItem("config"));

  if (config) {
    if (
      document.getElementById("config_ding") &&
      document.getElementById("config_bgcolor") &&
      document.getElementById("config_custom_audio")
    ) {
      // set the HTML values and then hit each of the methods to read
      document.getElementById("config_ding").checked = config["ding"];
      document.getElementById("config_bgcolor").value = config["bgcolor"];
      toggle_audio(document.getElementById("config_ding"));

      // restore custom audio file if available
      if (config["custom_audio"]) {
        custom_audio_file = config["custom_audio"];
      }

      // restore background color
      change_bgcolor(config["bgcolor"]);

      // restore default timer length (in minutes)
      if (config["default_timer_length"]) {
        set_timer(config["default_timer_length"]);
      }

      // restore daily points threshold
      if (config["daily_points_threshold"]) {
        daily_points_threshold = config["daily_points_threshold"];
        if (document.getElementById("config_points_threshold")) {
          document.getElementById("config_points_threshold").value = daily_points_threshold;
        }
      }

      // restore show_scoring
      if (typeof config["show_scoring"] === 'undefined') {
        show_scoring = false;
      } else {
        show_scoring = config["show_scoring"];
      }
      if (document.getElementById("config_show_scoring")) {
        document.getElementById("config_show_scoring").checked = show_scoring;
      }
      update_gamification_panel();
    }
  } else {
    // Default: show scoring OFF (opt-in)
    show_scoring = false;
    if (document.getElementById("config_show_scoring")) {
      document.getElementById("config_show_scoring").checked = false;
    }
    update_gamification_panel();
  }
}

function save_config() {
  // cycle through form elements and save the values to localstorage
  var config_data = {};
  config_data["default_timer_length"] = start_timer_seconds / 60; // current_timer is in seconds, need to convert to mins
  
  document.querySelectorAll(".config_el").forEach(function (o) {
    if (o.type == "checkbox") {
      config_data[o.name] = o.checked;
      if (o.name === "show_scoring") show_scoring = o.checked;
    } else if (o.type == "file") {
      // File input handled separately via handle_custom_audio function
      // Don't include file input in config data
    } else {
      config_data[o.name] = o.value;
      // Handle specific fields
      if (o.name === "daily_points_threshold") {
        config_data[o.name] = parseInt(o.value);
        daily_points_threshold = parseInt(o.value);
      }
    }
  });

  // Save custom audio file separately
  if (custom_audio_file) {
    config_data["custom_audio"] = custom_audio_file;
  }

  // store the combined data
  localStorage.setItem("config", JSON.stringify(config_data));

  // immediately set the new backgroud color
  change_bgcolor(config_data["bgcolor"]);

  // immediately update scoring panel visibility
  update_gamification_panel();
}

function populate_task_summary(task_data) {
  // calculate total time of tasks
  total_time = 0;
  for (i in task_data) {
    total_time += parseInt(task_data[i].estimate);
  }
  var task_summary = document.querySelector("#task-summary .sum");
  var total_hours = Math.floor(total_time / 60);
  var remainger_minutes = total_time % 60;
  task_summary.innerHTML =
    "Summary: " +
    total_hours +
    " hours & " +
    remainger_minutes +
    " minutes (" +
    total_time +
    " total minutes)";
}

function restore_tasks() {
  // read from storage
  var task_data = JSON.parse(localStorage.getItem("tasks"));

  if (task_data) {
    for (i in task_data) {
      // call add_task for each, but override the saving
      add_task(task_data[i].name, task_data[i].estimate, false);
    }
  }

  populate_task_summary(task_data);
  hookup_task_buttons();
}

function add_task(new_task_name, new_task_estimate, save = true) {
  var task_template = document.querySelector(".task.template");
  var new_task = task_template.cloneNode(true);
  task_id = document.querySelectorAll("#tasks .task .start").length;
  new_task.classList.remove("template");
  new_task.querySelector(".name").innerHTML =
    new_task_estimate + " - " + new_task_name;
  new_task.querySelector(".start").setAttribute("minutes", new_task_estimate);
  new_task.querySelector(".start").setAttribute("description", new_task_name);
  new_task.setAttribute("task-id", task_id);
  document.getElementById("tasks").appendChild(new_task);

  // add to store in localstorage
  if (save == true) {
    var task_data = JSON.parse(localStorage.getItem("tasks"));
    if (task_data) {
      var new_task_index = task_data.length;
    } else {
      task_data = [];
      var new_task_index = 0;
    }

    task_data[new_task_index] = new Object();
    task_data[new_task_index].name = new_task_name;
    task_data[new_task_index].estimate = new_task_estimate;

    localStorage.setItem("tasks", JSON.stringify(task_data));
  }

  // clear the input
  document.getElementById("new_task_input").value = "";
  document.getElementById("new_task_input").focus();
}

function process_add_task_form() {
  var new_task_input = document.getElementById("new_task_input");

  if (new_task_input.value) {
    if (new_task_input.value.trim() == "") {
      return false;
    }
    var temp = new_task_input.value.split(" - ");

    // catch for user entering value without a "-"
    if (temp.length == 1) {
      // if they started with a number, just forgot the "-" then let's assume that number is the time (i.e. "15 do some stuff")
      var str_split_on_space = new_task_input.value.split(" ");
      if (parseInt(str_split_on_space[0]) > 0) {
        // first item is an int, let's assume that's our time estimate
        var new_task_estimate = parseInt(str_split_on_space[0]);
        str_split_on_space.splice(0, 1);
        var new_task_name = str_split_on_space.join(" ");
      } else {
        // user didn't start with a number, so let's just set a default timer of 15 mins
        var new_task_name = temp[0].trim();
        var new_task_estimate = 15;
      }
    } else {
      var new_task_name = temp[1].trim();
      var new_task_estimate = temp[0].trim();
    }
    add_task(new_task_name, new_task_estimate);
  }

  // make sure the newly added buttons have functioning start and remove buttons
  reset_tasks();
  return false;
}

function start_timer_from_task(task) {
  task_minutes = task.getAttribute("minutes");
  task_description = task.getAttribute("description");

  // clear input minutes so user can override task timer and start a new timer fresh
  input_minutes = "";

  is_task_timer_running = true;
  points_award_remaining_ms = 60000;
  points_last_award_time = Date.now();
  start_points_tracking();

  set_timer(task_minutes, task_description);
  reset_and_restart_timer();
  close_task();
}

function reset_tasks() {
  document.getElementById("tasks").innerHTML = "";
  restore_tasks();
}

function remove_task(task) {
  // get the task id
  var parent_node = task.parentNode;
  var task_index = parseInt(parent_node.getAttribute("task-id"));

  // remove from localStorage
  var task_data = JSON.parse(localStorage.getItem("tasks"));
  task_data.splice(task_index, 1);
  localStorage.setItem("tasks", JSON.stringify(task_data));

  // clear and restore tasks from localStorage
  reset_tasks();
}

function hookup_task_input() {
  // hookup the form itself (to capture enter/submit actions)
  document.querySelector("#new_task_form").addEventListener("submit", (e) => {
    process_add_task_form();
    e.preventDefault();
    return false;
  });

  // hookup the add button
  document.querySelector("#new_task_submit").addEventListener("click", () => {
    process_add_task_form();
  });
}

function hookup_task_buttons() {
  document.querySelectorAll("#task-list .start.button").forEach((el) => {
    el.addEventListener("click", () => {
      start_timer_from_task(el);
    });
  });
  document.querySelectorAll("#task-list .remove.button").forEach((el) => {
    el.addEventListener("click", (e) => {
      remove_task(el);
      e.preventDefault();
    });
  });
}

function init() {
  // attach methods to page objects (since we're not allowed to do inline method calls from the HTML file)
  document
    .querySelector("#close_task_list_button")
    .addEventListener("click", () => {
      close_task();
      return false;
    });

  document.querySelector("#config_ding").addEventListener("change", function() {
    toggle_audio(this);
  });

  document.querySelector("#config_custom_audio").addEventListener("change", function() {
    handle_custom_audio(this);
  });

  document.querySelector("#config_bgcolor").addEventListener("change", function() {
    change_bgcolor(this);
  });

  // Add validation for daily points threshold input
  document.querySelector("#config_points_threshold").addEventListener("blur", function() {
    var value = parseInt(this.value);
    var min = parseInt(this.min);
    var max = parseInt(this.max);
    
    // Store the previous valid value
    var previousValue = daily_points_threshold || 100;
    
    // Validate the input
    if (isNaN(value) || value < min || value > max) {
      // Reset to previous valid value
      this.value = previousValue;
      daily_points_threshold = previousValue;
    } else {
      // Update the threshold with the new valid value
      daily_points_threshold = value;
    }
  });

  // Add input validation for immediate feedback
  document.querySelector("#config_points_threshold").addEventListener("input", function() {
    var value = parseInt(this.value);
    var min = parseInt(this.min);
    var max = parseInt(this.max);
    
    // If the input is empty, allow it (user might be typing)
    if (this.value === "") {
      return;
    }
    
    // If the value is invalid, show visual feedback
    if (isNaN(value) || value < min || value > max) {
      this.style.borderColor = "#ff0000";
    } else {
      this.style.borderColor = "";
    }
  });

  document
    .querySelector("#save_config_button")
    .addEventListener("click", () => {
      close_config();
    });

  // Add settings button click event
  document
    .querySelector("#settings-button")
    .addEventListener("click", () => {
      if (config_is_showing) {
        close_config();
      } else {
        open_config();
      }
    });

  // Add task list button click event
  document
    .querySelector("#tasklist-button")
    .addEventListener("click", () => {
      if (task_is_showing) {
        close_task();
      } else {
        open_task();
      }
    });

  // Add hover control button events
  document
    .querySelector("#play-pause-btn")
    .addEventListener("click", () => {
      if (timer_paused) {
        start_timer();
      } else {
        pause_timer();
      }
    });

  document
    .querySelector("#reset-btn")
    .addEventListener("click", () => {
      reset_and_restart_timer();
    });

  //hookup_task_buttons()
}

var window_height = window.innerHeight;
var window_width = window.innerWidth;
var window_x = window.screenLeft;
var window_y = window.screenTop;
var config_is_showing = 0;
var task_is_showing = 0;
var play_audio_on_complete = 1;
var custom_audio_file = null;

// designed to be initiated after page loads in index.html
window.onload = function () {
  document.onkeypress = function (e) {
    catch_keypress(e);
  };
  document.onkeydown = function (e) {
    catch_onkeydown(e);
  }; // needed for Escape key handling

  restore_config();
  restore_tasks();
  restore_gamification_data();
  init();
  start_timer();
  hookup_task_input();

  // Responsive font size for timer description
  window.addEventListener('resize', () => fitTextToContainer("timer-description"));
};
