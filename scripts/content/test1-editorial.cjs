/* Editorial transcriptions checked against the supplied TEST 1 PDFs on 2026-11-10.
 * This is text/source review, not approval of the remaining audio recordings.
 * Existing pilot and supplemental records are deliberately not reconstructed here.
 */
const spoken = {
  2: [
    null,
    "She's swimming in the water.",
    "She's jogging near the ocean.",
    'Chairs are set up on the beach.',
    'A hat is lying on the sand.',
  ],
  3: [
    null,
    "She's reaching for an item from a display case.",
    "She's holding on to a shopping cart.",
    'Some goods are being arranged on shelves.',
    'Some merchandise has fallen on the floor.',
  ],
  4: [
    null,
    'A fence is being painted in a park.',
    'One of the women is putting on a jacket.',
    'Some people are working in a garden.',
    'Some people are looking up at the trees.',
  ],
  5: [
    null,
    'A carpet is being rolled up.',
    'Some curtains have been closed.',
    'Some cushions are piled on the floor.',
    'Some reading materials have been placed in front of a sofa.',
  ],
  6: [
    null,
    'Some musicians are performing on a porch.',
    'Some steps are being repaired.',
    'Some music stands are being folded up.',
    'Some instruments have been placed in their cases.',
  ],
  8: [
    'When should we leave for the airport?',
    "This afternoon at two o'clock.",
    'I prefer an aisle seat.',
    'Mr. Choi traveled there last year.',
  ],
  9: [
    "Where's the hiring event being held?",
    'She sent it to a colleague.',
    'In the main conference room.',
    'If they open on time.',
  ],
  10: [
    'Why is the budget being updated?',
    'When we rented the building.',
    'With the new designs.',
    'Because new sales figures came in.',
  ],
  11: [
    'Can you cover my shift at work tomorrow?',
    "No, I'm taking the day off.",
    'Before he updated the Web site.',
    "It's on the agenda for Tuesday.",
  ],
  12: [
    'Who ordered these vegetables?',
    'All of it.',
    'I believe Luis did.',
    'It was excellent, thanks.',
  ],
  13: [
    'How often should I mail the notices?',
    'Once a month.',
    "After three o'clock.",
    'About half of them.',
  ],
  14: [
    'Which folder are the documents in?',
    'We agreed on the deadline.',
    "Sure, I'll take a look.",
    'Let me show you.',
  ],
  15: [
    'Did you end up going to a movie or to the concert last night?',
    'I saw the new action film.',
    'It just ended.',
    'Just a couple of my friends.',
  ],
  16: [
    "We'll take the company bus to the conference center.",
    "I'm sure it's not.",
    'Maybe we did.',
    "That's a good plan.",
  ],
  17: [
    'What should we put in the introduction to the report?',
    'After the summary.',
    'The research highlights.',
    'I met him yesterday.',
  ],
  18: [
    'We should have a new logo designed.',
    "They're about five miles from here.",
    'I know a good graphic artist.',
    'An order for some new calendars.',
  ],
  19: [
    'Did you select a site for the new headquarters?',
    'Is that so?',
    'No one can attend the training.',
    'Yes, in the center of town.',
  ],
  20: [
    "Who's going to cancel the meeting?",
    'Martin is the most senior team member.',
    "Josie's chair is broken.",
    'The client signed the contract.',
  ],
  21: [
    'How was your business trip?',
    'They found some just in time.',
    'I like that idea.',
    'It was very productive.',
  ],
  22: [
    'Why did Chae-Won hire an assistant?',
    'She will submit an estimate in September.',
    'Anyway, they thought I was late.',
    "Haven't you noticed how busy she is?",
  ],
  23: [
    'Would you mind showing me the new office space?',
    "I think that's correct.",
    "Sure—it won't take long.",
    'Everyone available participated.',
  ],
  24: [
    "We're trying to decide where to order from for lunch.",
    "I loved those sandwiches from Gino's last week.",
    "My brother's friend was there.",
    'I remember that song very well.',
  ],
  25: [
    'When do you plan to finish the advertising campaign?',
    "Next to Irina's office.",
    'By Monday morning at the latest.',
    "Because it didn't make sense to me.",
  ],
  26: [
    'Where will the guest speaker be joining us from?',
    'Nobody shared the details with me.',
    "He wasn't gone too long.",
    'First thing in the morning, I believe.',
  ],
  27: [
    "Wouldn't you prefer that Mi-Sun lead the training?",
    'No, I filed it three months ago.',
    'I just gave them to the director.',
    "I don't think she works here anymore.",
  ],
  28: [
    'We should get some feedback on this book cover design.',
    'Ahmed has a visual arts degree.',
    'They probably skipped a week.',
    'It was really hard to hear.',
  ],
  29: [
    'Would you be able to delay the meeting?',
    'How much storage does it have?',
    'Most people seemed to enjoy it',
    'Tatyana needs to leave for the airport in an hour.',
  ],
  30: [
    "Will you rent a car or take the train while you're visiting?",
    'They found some near the coast.',
    "I don't like driving in the city.",
    'Mostly some old desks.',
  ],
  31: [
    "Seven thirty at night is rather late for a meeting, isn't it?",
    'If people agree on it, I will.',
    "I promise I'll keep it short.",
    'I am not sure who he meant.',
  ],
};

// [one-based pages in PDF 1.7, transcript]. Superscript answer pointers are omitted.
const conversations = {
  32: [
    [5, 6],
    `W-Am: Hello. I'm calling about my tickets for tonight's baseball game. I'm hoping to upgrade my seats so we can sit closer to the field. The reservation is under my name: Joanna Reynolds.
M-Cn: Let me take a look. Hmm. I'm sorry, Ms. Reynolds, but our system seems to be down at the moment. I can do the exchange manually, but it'll take a little longer.
W-Am: No problem. I have time.
M-Cn: Thanks. Oh, and just a reminder that better seats will cost more—you'll need to pay about 15 dollars more per seat.`,
  ],
  35: [
    [6],
    `W-Am: Thilo, are you going to the company lunch later this morning at Sullivan Bistro? I'm not sure how to get there.
M-Au: Well, the train stops right near it on Hanover Street, but you'd have to transfer a few times. You know, I'm getting a ride with Farida, and she has a van.
W-Am: Oh, that would be convenient! Do you know where her desk is?
M-Au: Yes. She has the cubicle closest to the stairs.`,
  ],
  38: [
    [7],
    `M-Au: Hi, Sarika. We need a new assistant manager here at Jeera Groceries. You've been one of our best cashiers for two years now. Are you interested in the position?
W-Br: Wow. I definitely am. My one concern is the working hours. Would my schedule change significantly?
M-Au: You might have to work overtime once in a while, like when food deliveries arrive late, but that doesn't happen often. Why don't you think about it for a few days? Let me know what you decide.`,
  ],
  41: [
    [8],
    `M-Cn: Good morning. This is Westerly Travel's customer service. How may I help you?
W-Br: Yes, I was supposed to take the two P.M. from Denver to Colorado Springs, but it was canceled. I need to book a different train. I am presenting at a trade show first thing in the morning, so I'm hoping you can get me on another train today.
M-Cn: The four P.M. departure gets you in by six thirty, and there are plenty of seats available.
W-Br: That sounds great.
M-Cn: And to apologize for the inconvenience, I've upgraded you to business class at no extra charge.`,
  ],
  44: [
    [9],
    `W-Am: This is Marcy Ardmore at Sladen Motors. Some automotive parts we ordered from your factory haven't arrived at our dealership yet.
M-Au: I'm sorry to hear that. We sent your order over a week ago, but the shipping company has been experiencing delays. Unfortunately, the tracking e-mails they sent us don't contain enough detail to determine when the parts will get to you.
W-Am: I see. Do you have contact information for the shipping company? I'd like to see what I can find out.
M-Au: Yes, I can give you their phone number. But I'll also call them. Hopefully the more inquiries they get, the more seriously they'll take the issue.`,
  ],
  47: [
    [10],
    `M-Au: Amina, how are plans progressing for the September release of our new model of mobile phone?
W-Br: Good. Right now, the marketing department is looking at advertising options and thinking about the best way to get maximum exposure in the media.
M-Au: Great. And what's the update from our manufacturer about when they'll begin production? Last time we spoke, you mentioned that the factory was at full capacity with other projects, and I'm worried that'll affect our timeline.
W-Br: I just spoke with them, and they'll free up room for us soon.`,
  ],
  50: [
    [11],
    `W-Br: Hi, Luca. Is the restaurant almost ready for this afternoon's awards dinner?
M-Au: Actually, now that the room's been set up, I see that we're short a few tables and chairs.
W-Br: Oh, I've already taken care of that. I called a rental company, and they'll be delivering the furniture we need in an hour.
M-Au: Thanks for doing that. Did you also look over the final guest list? I haven't had time to do that yet.
W-Br: No, I haven't. Why don't we do that together now?`,
  ],
  53: [
    [12],
    `M-Cn: Marcella, we have a problem with the business conference we're hosting next week. I just got a call from the conference center, and they said there's been wafer damage to three of the meeting rooms.
W-Am: Oh no! But the rooms will be repaired in time for our conference, right?
M-Cn: They said there's a lot of damage.
W-Am: OK. Well, the weather's supposed to be nice, so we could host some of the seminars outdoors. It's a little unconventional, but there's plenty of space surrounding the conference center.`,
  ],
  56: [
    [12, 13],
    `W-Am: Great. I hear a lot of health-care providers are switching to this same software.
M-Au: Yes. It's becoming popular because it retains all of a patient's medical records from different providers in one central system.
W-Br: Excuse me. Sorry to interrupt.
M-Au: No problem, Francesca. What's up?
W-Br: I overheard what you said, and just to clarify, the program can only collect and retain records from providers who use the same software, so Marion may find she still has to call around to obtain all the patient records she needs.`,
  ],
  59: [
    [13, 14],
    `W-Am: Let's get this product-innovation meeting started. Sales of our fruit-and-nut bars have been strong, so we'd like to develop some other types of snack bars. What do you recommend, Stan?
M-Cn: Well, we know that many people are allergic to nuts, so we should develop some snack bars without nuts. The only thing is, we'd need a separate set of equipment to avoid contamination between the two production areas.
W-Am: We don't have room at this facility for that. Pedro, you've been to our new production facility in Glenview, right? Is there space there for new equipment?
M-Au: I think there's extra space there. I'll check with the facility manager to make sure, though.`,
  ],
  65: [
    [16],
    `M-Cn: Hi. I'm here for the health and wellness conference. I parked in the event center parking area. I was wondering, is parking free for conference attendees?
W-Br: I'm sorry. We don't provide any reimbursements for parking. But if you're willing to move your car, there's a cheaper parking area at Seventh Avenue and Vine Street. It's about a block away.
M-Cn: Oh, unfortunately, I don't have time. I'm scheduled to attend the strength-training seminar that starts in fifteen minutes. But tomorrow I'll get here earlier and park at the other lot. Seventh and Vine, you said. Right?
W-Br: That's correct.`,
  ],
  68: [
    [17],
    `M-Cn: Molina's Office Store. How can I help?
W-Am: Hi. I've been trying to order a product on your Web site, but everytime I get to the checkout screen, everything freezes, and I can't place the order.
M-Cn: What are you trying to buy?
W-Am: The Enzo 5000 scanner.
M-Cn: Hmm. That product's currently out of stock. Can I recommend the Rhenium 60 instead? It's a popular model.
W-Am: I really need the Enzo 5000—I'm an artist and I make my own prints, so I need a model that produces top-quality images.
M-Cn: I see. Well, we're expecting a shipment tomorrow. If it includes the model you're looking for, I can reserve it for you.`,
  ],
  71: [
    [18],
    `W-Am: Attention all film lovers! The Braddon Cinema has just opened. Its interior is designed to resemble the classic cinemas from the 1920s. It offers comfortable, reclining seats and individual tray tables for food and drinks. The grand opening is next week and will feature showings of classic films from different eras! And here's good advice: to avoid traffic in the city center, the Braddon Cinema is easily reached by riding the train to Center Station.`,
  ],
  74: [
    [19],
    `M-Cn: Hi. This is Abdi calling from the Springtown Hotel reservation desk. We received your e-mail regarding your upcoming reservation. I see that you asked to move to a room facing the ocean. We make every effort to accommodate such requests, but those rooms are always booked far in advance. Your current room, though, has a lovely view of our garden, which we think you will quite enjoy this time of year. And don't forget to bring your swimming suit! Our new pool will be open for the first time this weekend.`,
  ],
  77: [
    [20],
    `W-Ain: Good morning, volunteers. My name is Lisa Campbell. Thank you for coming today to help us maintain the natural habitat here at the Blue Mountain Forest Preserve. Forest conservation is so important! Since this is your first day, I'll cover some of the basics. I advise you to always carry water with you. We have refillable bottles, and everyone is welcome to take one as a gift from us at the forest preserve. It can get hot in the afternoon, so staying hydrated is important. Now, if you'll follow me, I'll show you the steps for planting young tree saplings to support biodiversity.`,
  ],
  80: [
    [20, 21],
    `W-Br: Hello. I'm calling about the financial-management workshop that your company is hosting later this week. I'm with the Archton Group; we registered for the workshop over a month ago. I realized that we never received the meal vouchers that are supposed to be part of the workshop package. We need these because we have ten people attending, and we are traveling long-distance to attend the conference. Would you please send me an e-mail with the meal vouchers included as an attachment as soon as you can? Thank you.`,
  ],
  83: [
    [21, 22],
    `M-Au: This is the end of our tour. Thank you for coming to the Oakton Garden Collective. I hope you've learned a lot about urban gardening. Feel free to spend more time looking around. Don't forget to pick up your free vegetable seedling before you leave. You can choose a cucumber plant or a tomato plant. Also, if you'd like to have your own garden plot next spring, applications are now available. You'll get a plot for just a small fee. We have many other fun activities listed in our monthly newsletter. Consider joining our e-mail list to receive these monthly updates about upcoming events.`,
  ],
  86: [
    [22, 23],
    `W-Br: Have you developed the perfect product but are unsure how to reach more customers? At Whole Planet Marketing, our team of expert digital marketers is ready to help you reach your target audience. Unlike other marketing firms, we'll connect you with a digital marketer who'll work with you individually. During your one-on-one meetings, you'll develop a marketing plan that will draw in customers. Just go to wholeplanetmarketing.com today to complete a brief questionnaire. Then, one of our specialists will contact you to make an appointment for a free proposal. Let Whole Planet Marketing bring customers to you!`,
  ],
  89: [
    [23, 24],
    `M-Au: Hello, everyone. There's very exciting news for all of us here at the Ziegler Research Institute. We've just been awarded the Sugiyama Grant to support our research into aquatic ecosystems. We can now invest in state-of-the-art equipment to study the biodiversity of coral reefs. As you may know, the Sugiyama Foundation offers a variety of substantial grants each year. It's notable, though, that for this particular award, they received over 200 applications. Our work at the reefs will probably not begin for several months. We still need to order the equipment. But I want to thank you for your efforts on the application.`,
  ],
  92: [
    [24, 25],
    `W-Am: On behalf of Onetech Solar, I'd like to welcome you to our manufacturing facility and congratulate you on your employment here. I'm Yuri Yamakawa, and today I'll be leading this orientation for new hires. We'll start with a video that provides an overview of the production process for the solar panels we make. Then we'll tour the various areas of the factory, including the assembly line and the quality-control inspection center. After lunch, my colleague Mariko Hara will join you. I have a consultation with a client. And now, let's get started with the video.`,
  ],
  98: [
    [26, 27],
    `W-Am: Good afternoon, everyone. I'd like to go over the product tests for our laptop-computer backpack, because they will require some design changes. As you know, we hired a marketing firm to test the prototype you designed among consumers. Now, we received very positive feedback overall. Consumers liked the separate computer compartment. However, many people felt that the shoulder straps were uncomfortable when the bag was full. It's important that the backpack have comfortable shoulder straps, since its purpose is to carry heavy equipment. We need to revise the design as quickly as possible, since we're scheduled to have our official product release early next year.`,
  ],
};

const part6 = {
  135: `# Gasgo Propane Tank Exchange

You have chosen a safe and [[1]] way to obtain fuel for your stoves, grills, heaters, fireplaces, or other devices. Simply follow the directions [[2]].

When your tank runs out of propane, take it to our store and leave it on one of the clearly marked green shelves outside the store. [[3]]. Then, pay the cashier inside the store for a fresh tank of propane. Next, the cashier or another staff member will accompany you to the outdoor exchange area. The staff person will give you a full tank to take home and provide help if you have multiple tanks to carry. Follow the instructions on the tank to connect it to your device.

Be sure to visit us again when you need a [[4]].`,
  139: `To: Technicarn Enterprises Customers
From: Technicarn Enterprises Customer Service
Date: 10 September
Subject: Serving You

Dear Valued Customer:

We want your [[1]] with Technicarn Enterprises to be easy and enjoyable. To that end, we are pleased to announce our newly designed Web site, with enhanced customer-friendly features. Our new Web site provides answers to your questions 24 hours a day, every day of the year. On our home page, you can get information about system setup, or you can troubleshoot by visiting [[2]] the Internet Issues or TV and Streaming Issues pages. [[3]], you can find detailed information concerning account management, access, billing, and payment.

[[4]]. Please explore the new Web site at your earliest convenience: www.technicarnenterprises.com. As always, thank you for allowing us to serve you.

Best regards,

The Technicarn Enterprises Customer Service Team`,
  143: `# Garner City Transport Cares About the Environment

Beginning May 1, the sale and use of paper tickets and transit passes will be [[1]] on all Garner City Transport bus and subway lines. This change applies to single-ride tickets [[2]] to weekly and monthly passes. Eliminating paper benefits the environment and leads to less litter.

Riders can download the free Garner City Transport app. With the app, they can add money their accounts, purchase tickets, plan [[3]], and track arrival and departure times.

Alternatively, passengers can purchase a rechargeable transit card at any station. [[4]]. Value can be added to the card via the Garner City Transport Web site at www.garnercitytransport.org.`,
};

// Full replacements where OCR dropped metadata, checkboxes or insertion markers.
const documents = {
  'g149-150-document-1': `To: Wenbin Peng <wpeng@chenconstruction.com>
From: Toshi Auto Group <cs@toshiautogroup.com>
Date: February 26
Subject: Your leased vehicle

Dear Mr. Peng:

As you know, Toshi Auto Group handles all the service needs for cars leased by employees of Chen Construction. According to our records, you took possession of your leased car on March 1 of last year. Your car is now due for its required annual service and maintenance check. To book your appointment, please call us at (215) 555-0109 or visit us online at www.toshiautogroup.com/serviceappointments.

Sincerely,

Toshi Auto Group
Customer Service`,
  'g156-157-document-1': `# SERVICE REQUEST FORM

Complete all fields and deliver to Technology Services (room 412).

| Field | Value |
| --- | --- |
| Requester Name | Elenora Deckow |
| Requester Office | Room 718 |
| Requester Phone | Ext. 5709 |
| Service Location | Room 500 |
| Service Type (choose one) | [ ] Cleaning; [x] Repair; [ ] Installation/Setup; [ ] Other |

## Description of Request

There is a problem with the television audio. When I played an online video, the image was fine, but I could not hear anything. I checked all the settings, and I was able to hear the same video on other televisions with no problem. I'm supposed to deliver a product demonstration for a client in room 500 next Monday, so I would greatly appreciate it if the issue can be fixed by this Friday.`,
  'g162-165-document-1': `To: amal.abboud@bunzifoundation.org
From: maria_mcfarland@myemail.com
Date: Thursday, August 22
Subject: Project Coordinator Position
Attachment: résumé_m.mcfarland.pdf

Dear Mr. Abboud,

My friend Josiah Wilkins told me that you are seeking a project coordinator for your company. I have a degree in business administration and am attaching my résumé as I think I am an excellent fit for your needs. As you will see, I have experience using several cloud-based project-management programs. Furthermore, my organizational skills enable me to coordinate multiple activities simultaneously, and I can convey expectations clearly to team members involved in each phase of a project.

My current role as project coordinator for an international engineering firm, where I have worked for the past five years, has also afforded me ample experience managing teams, schedules, and budgets. While I enjoy the kind of work I do, it has become clear to me that I need motivation from a strong mission. The goal of your company to create sustainable housing projects is something that I strongly support and would be delighted to work on.

Through my work and volunteer activities, I have spent many months abroad in various countries throughout Asia and the Middle East. This seems particularly relevant to mention, as I am comfortable leading geographically and culturally diverse teams.

Thank you for your attention, and I look forward to speaking with you soon.

Kind regards,

Maria McFarland`,
  'g169-171-document-1': `# PRODUCT DEMONSTRATORS NEEDED!

Are you outgoing and enthusiastic? — [1] —. Do you enjoy talking to all types of people? Put your personality and communication skills to work! — [2] —. BBD Staffing is seeking to hire in-store product demonstrators to promote our clients' merchandise to shoppers. — [3] —. As a member of our team, you will demonstrate a wide range of small kitchen appliances and tools in grocery stores and other retail venues.

For some products, you will be required to prepare simple recipes. You will also need to answer shoppers' questions. Thus, it is essential that you can become familiar with clients' products and provide key information to consumers. Because many of the demonstrations require working with food, candidates must have a Professional Food Handler certificate. — [4] —.

To apply, upload a video of no more than one minute in length telling us why you would be a successful product demonstrator at www.bbdstaffing.com/applications.`,
  'g172-175-document-1': `# Gorman Unveils Newest Smartphone Model

LONDON (20 April)—Gorman Mobile unveiled its newest smartphone to an eager reception at the annual Technobrit Conference. The Pro Phone 4, which includes 512 GB of storage, a 7-inch screen display, and an optional stylus pen, will hit the shelves on 11 June. Unlike its predecessor—the Pro Phone 3—it features a larger screen, an ultrawide camera lens, and 8K-resolution filming capability.

— [1] —. The £999 starting price is £100 more than that of the previous model. Add-ons, such as the stylus pen, protective case, and wireless headphones, cost an additional £39, £59, and £79, respectively. Gorman Product Manager Ian Hill doesn't believe the price increase will dissuade customers. — [2] —.

“The Pro Phone 4 is a game changer in terms of its picture quality and sleek design,” said Hill. “Improvements were based on direct customer feedback, which cited the poor camera functionality as the biggest drawback of prior models. Our clients spoke, and we listened and adapted accordingly.” — [3] —.

One similarity that the Pro Phone 4 has with previous models is the charger. Going against the trend of competing wireless companies, Gorman is instead focusing on convenience.

“We want to afford our customers the ability to reuse elements of the other Gorman devices they've already purchased,” said Hill. “Why add to the overload of cables already in circulation?” — [4] —.`,
  'g191-195-document-3': `# City of Abilene Administrative Building

Visitors must sign in prior to entering this facility. Please enter your name and the room you will visit in the logbook.

## First-Floor Directory

| Department | Room |
| --- | --- |
| IT Services | Room 100 |
| Parks and Recreation | Room 101 |
| Transportation | Room 102 |
| Wastewater | Room 103 |`,
  'g196-200-document-2': `To: Edith Hocking
From: Uma Joshi
Date: 2 March
Subject: RE: Opportunity

Dear Edith,

Thank you for agreeing to arrange an interview with Mr. Eklund for me. I think this will be a great follow-up to my recent piece.

In a helpful coincidence, I will be visiting his home country next month to address a journalists' convention. I am the featured speaker and will discuss the benefits of diversity in journalism. I'm sure we can set up something with Mr. Eklund just before or after my speech.

Best,

Uma Joshi
Arts and Culture Editor
Top News U.K.`,
  'g196-200-document-3': `To: Uma Joshi <ujoshi@topnews.co.uk>
From: Maria Cazalla <mcazalla@zephyrmail.se>
Date: 20 March
Subject: RE: Information

Dear Ms. Joshi,

We are all very excited about your interview next month with Mr. Eklund. He enjoys all your writing for Top News U.K.—the news stories, interviews, and, of course, your recent article about The Theatre Lights Dimmed!

I just wanted to finalize a few details with you. We have arranged transportation for you from your hotel to Mr. Eklund's house and then back to the hotel. Please let me know how many people there will be in your group, because Mr. Eklund would like you all to stay for lunch.

Sincerely,

Maria Cazalla`,
};

const questionEdits = {
  33: { options: { B: 'A line is very long.' } },
  100: { options: { D: "The cost of a product's materials will rise soon." } },
  161: {
    questionText:
      'At 11:43 A.M., what does Ms. Glatt most likely mean when she writes, "Sounds great"?',
  },
  182: { questionText: "In the review, what is indicated about Neptune's Voyage?" },
  184: { questionText: "What does Mr. Weber find exciting about Neptune's Voyage?" },
  185: { options: { C: 'On April 1', D: 'On May 5' } },
  198: { options: { D: 'To speak at a conference' } },
};

// Original editorial reasons; Listening reasons concern the printed transcript,
// not a claim that the corresponding MP3 has been listened to.
const answerReasons = {
  2: 'The photo shows chairs set up on the beach.',
  3: 'The woman is holding a shopping cart.',
  4: 'The people are working in a garden.',
  5: 'Reading materials are on the table in front of the sofa.',
  6: 'Musicians are performing on a porch.',
  8: 'The response gives a departure time: this afternoon at two.',
  9: 'The main conference room answers the location question.',
  10: 'New sales figures explain the budget update.',
  11: 'The speaker declines because they are taking the day off.',
  12: 'Luis identifies who ordered the vegetables.',
  13: 'Once a month specifies the requested frequency.',
  14: 'Offering to show the folder answers where the documents are.',
  15: 'Seeing the new action film answers the movie-or-concert question.',
  16: 'Calling it a good plan agrees with the proposed bus journey.',
  17: 'Research highlights are suitable content for the report introduction.',
  18: 'A graphic artist can design the proposed logo.',
  19: 'The center of town identifies the selected headquarters site.',
  20: 'The senior team member is the suggested person to cancel the meeting.',
  21: 'Very productive describes how the business trip went.',
  22: 'Her busy workload explains why she hired an assistant.',
  23: 'The speaker agrees to show the office space.',
  24: "Recommending Gino's sandwiches helps choose a lunch provider.",
  25: 'Monday morning at the latest states the completion deadline.',
  26: 'The speaker says they have not been given the location details.',
  27: 'Mi-Sun no longer working there explains why she cannot lead the training.',
  28: "Ahmed's visual arts degree makes him a useful person to ask for design feedback.",
  29: "Tatyana's imminent airport departure makes a later meeting impractical.",
  30: 'Disliking city driving implies a preference for the train.',
  31: 'Promising a short meeting responds to concern about its late start.',
  32: 'The caller wants to upgrade her baseball tickets.',
  33: 'The reservation system is down.',
  34: 'Better seats cost about 15 dollars more per seat.',
  35: 'The speakers will attend the company lunch.',
  36: 'The van suggests there may be room for another passenger.',
  37: "She asks where Farida's desk is so she can speak to her.",
  38: 'Jeera Groceries and the cashier position identify a grocery store.',
  39: 'The woman explicitly asks whether her working hours will change.',
  40: 'The man suggests thinking about the offer for a few days.',
  41: "The woman's original train was canceled.",
  42: 'She will present at a trade show the following morning.',
  43: 'The man upgrades her to business class without an extra charge.',
  44: 'The caller says the parts have not reached their dealership.',
  45: 'The tracking e-mails do not contain enough delivery information.',
  46: "She requests the shipping company's phone number.",
  47: 'The speakers discuss the release of a new mobile phone.',
  48: 'The marketing department is considering advertising options.',
  49: 'A fully occupied factory could delay the production timeline.',
  50: 'They are preparing the restaurant for an awards dinner.',
  51: 'A rental company will deliver tables and chairs in an hour.',
  52: 'The woman proposes reviewing the final guest list together.',
  53: 'They discuss the business conference they will host next week.',
  54: 'The extensive damage contradicts the assumption that repairs will finish in time.',
  55: 'The woman suggests holding seminars outdoors.',
  56: 'Health-care providers and patient records identify medicine.',
  57: 'The software centralizes patient records for easier access.',
  58: 'Records from providers using other software may still require phone calls.',
  59: 'They want to develop additional types of snack bars.',
  60: 'Nut-free production requires a separate set of equipment.',
  61: 'Pedro will ask the facility manager about available space.',
  65: 'Parking is not reimbursed for conference attendees.',
  66: 'The graphic places Area 3 at Seventh Avenue and Vine Street.',
  67: 'The strength-training seminar starts in fifteen minutes.',
  68: 'The checkout screen freezes when the caller tries to order online.',
  69: 'The Enzo 5000 is priced at $179.99 in the graphic.',
  70: 'The man will check whether the incoming shipment contains the requested scanner.',
  71: 'The speaker emphasizes decor modeled on classic 1920s cinemas.',
  72: 'The grand opening features screenings of classic films.',
  73: 'Taking the train to Center Station avoids city-center traffic.',
  74: 'The guest requested an ocean-facing room instead of the current assignment.',
  75: 'Advance bookings explain why the hotel cannot grant the room-change request.',
  76: 'The new pool is opening, so the guest should bring swimwear.',
  77: 'The speaker introduces volunteers to conservation work at a forest preserve.',
  78: 'She advises carrying water and offers refillable bottles.',
  79: 'She will demonstrate how to plant young trees.',
  80: 'The group is traveling to attend a financial-management workshop.',
  81: 'The group never received the meal vouchers included in the package.',
  82: 'She asks for an e-mail with the vouchers attached.',
  83: 'Visitors may collect a free vegetable seedling before leaving.',
  84: 'Applications for a garden plot are available.',
  85: 'The monthly e-mail newsletter lists upcoming activities.',
  86: 'Whole Planet Marketing offers digital marketing services.',
  87: 'Each client works individually with a digital marketer.',
  88: 'Completing the online questionnaire leads to an appointment.',
  89: 'Research into coral-reef ecosystems concerns marine biologists.',
  90: 'Winning among over 200 applicants makes the grant especially impressive.',
  91: 'The institute still needs to order the necessary equipment.',
  92: 'The speaker is leading an orientation for new hires.',
  93: 'She welcomes the listeners to the manufacturing facility.',
  94: 'A colleague will lead the afternoon while she consults a client.',
  98: 'The speaker addresses the people who designed the prototype.',
  99: 'The shoulder straps will be revised; their approval bar is 50 percent.',
  100: 'The official product release is scheduled for early next year.',
  104: 'Manage fits the meaning of administering natural resources and wildlife.',
  105: 'Safely is the adverb modifying complete their tasks.',
  106: 'Credentials make someone highly qualified to teach.',
  107: 'Attendance is the noun serving as the subject of is mandatory.',
  108: 'Occasionally expresses how often performers appear at the café.',
  109: 'That introduces the content clause after were assured.',
  110: 'Such as introduces examples of new products.',
  111: 'The preposition of is followed by the gerund improving.',
  112: 'An e-mail or text alert is a notification about a password change.',
  113: 'Remarkable is the adjective modifying decrease.',
  114: 'Directly into describes placing the potatoes straight into the fryer.',
  115: 'The possessive determiner their modifies customers.',
  116: 'Consider applicants means evaluate them for the position.',
  117: 'Actively is the adverb modifying involved.',
  118: 'Renew the contract means extend its validity.',
  119: 'Protective is the adjective modifying layer.',
  120: 'A merger combines three branches into one.',
  121: 'Confidential describes records with restricted access.',
  122: 'Recent trends are developments in online health-care services.',
  123: 'Restaurants receive the inspections, requiring the passive are inspected.',
  124: 'A loyal customer base returns to the bakery.',
  125: 'Investments is the plural noun subject of are expected.',
  126: 'Accessible to means the harbor can be used by the vessels.',
  127: 'Consequently marks increased sales as a result of advertising expansion.',
  128: 'Not until links introducing flavors to completion of the survey analysis.',
  129: 'The gym receives equipment, requiring has been equipped.',
  130: 'Instead of contrasts driving with using the bus.',
  135: 'Economical is the adjective coordinated with safe.',
  136: 'Below points to the instructions that follow.',
  137: 'Do not take it inside refers to leaving the empty tank outdoors.',
  138: 'Replacement is the new tank needed when the current one runs out.',
  139: 'Experience is the noun required after your.',
  140: 'Either pairs with or to offer two troubleshooting pages.',
  141: 'Moreover introduces additional account-management information.',
  142: 'The support-number sentence provides an alternative when online help is insufficient.',
  143: 'Discontinued means paper tickets will no longer be sold or used.',
  144: 'As well as extends the change from single rides to weekly and monthly passes.',
  145: 'Routes are what transit passengers plan in the app.',
  146: 'The sentence about recycled cards supports the environmental theme and refers to the transit card.',
  149: 'The e-mail says the leased car is due for its annual maintenance.',
  150: 'The opening sentence says Chen Construction employees lease cars.',
  151: 'Tillford Press announces its new Tillford Exalt imprint.',
  152: "Lain Lai's life story is scheduled for December publication.",
  153: 'Bissett emphasizes authors from varied cultural backgrounds and perspectives.',
  154: 'The loading-dock power door opens and then drops shut unexpectedly.',
  155: 'He agrees to train the newcomers by having them pack and label shipments.',
  156: 'The television displays the video but produces no sound.',
  157: 'She will deliver a product demonstration for a client next Monday.',
  158: 'The executive board meeting is the 2:30 meeting.',
  159: 'Bill reviews quarterly reports with the finance team.',
  160: 'Ella needs clarification about the next advertising-campaign budget.',
  161: "She accepts Daniel Seidal's offer to attend from 2:00 to 2:15.",
  162: 'Josiah Wilkins told her about the project-coordinator vacancy.',
  163: 'Convey expectations means communicate them to the team.',
  164: 'She wants motivation from a strong mission she supports.',
  165: 'Her overseas experience supports her ability to lead culturally diverse teams.',
  166: 'Trexdale produces laboratory cabinets, workstations, benches and other furniture.',
  167: "It changed a client's laboratory layout to maximize space.",
  168: 'The Web page directs visitors to fill out an interest form.',
  169: 'Preparing recipes and holding a food-handler certificate align with cooking experience.',
  170: 'Applicants must upload a video of no more than one minute.',
  171: 'Position [3] follows the company and clients introduction, giving our product demonstrators a clear referent.',
  172: 'The article introduces the new Gorman Pro Phone 4.',
  173: 'The listed additional price for wireless headphones is £79.',
  174: 'The charger remains compatible with previous Gorman models.',
  175: 'Position [1] connects the new features to the paragraph about the higher price.',
  181: 'The sender is a project manager coordinating game development.',
  182: 'The review explicitly describes an open-world format.',
  183: 'The review confirms the blue and green rendering problem has been corrected.',
  184: 'Players discover new areas and devices with fewer instructional guides.',
  185: 'The review states that the game launches May 5.',
  191: 'All records requests must be submitted through the Web portal.',
  192: 'The pipeline maps will inform his firm’s wastewater-management advice to the city.',
  193: 'The sign requires visitors to enter their name and destination room in a logbook.',
  194: 'The instructions promise an itemized statement explaining any fees.',
  195: 'His request concerns wastewater; the directory places that department in Room 103.',
  196: 'The review describes Eklund as a captivating actor on stage and screen.',
  197: 'The interview will take place in his home country, identified as Sweden.',
  198: 'She will address a journalists’ convention as the featured speaker.',
  199: 'The second e-mail finalizes transportation, group size and lunch arrangements.',
  200: 'His assistant says he enjoys her writing, including the recent book review.',
};

// Independently transcribed from the supplied answer image, five questions per row.
const answerRows = [
  'DCBCD',
  'ABABC',
  'ABACA',
  'CBBCA',
  'CCBAB',
  'ACACB',
  'BADCC',
  'ABABD',
  'CBDCD',
  'BBADC',
  'DACCA',
  'ABACB',
  'AADBD',
  'CABDD',
  'CDBCD',
  'BCABD',
  'CADAA',
  'BDCAB',
  'DDCBA',
  'DCCBB',
  'CBABD',
  'DABCD',
  'CBDDA',
  'BBACD',
  'BCDBD',
  'ABBCB',
  'BCCAD',
  'ACDAA',
  'DDBDA',
  'CABBC',
  'CBDDC',
  'CDCBC',
  'AABDD',
  'CADAC',
  'CBCDA',
  'CABDC',
  'ABBDD',
  'CACBA',
  'BBDAD',
  'CADBC',
];

module.exports = {
  spoken,
  conversations,
  part6,
  documents,
  questionEdits,
  answerReasons,
  answerRows,
};
