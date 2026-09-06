export const translations = {
  en: {
    appName: 'TaxiPay',
    subtitle: 'Conductor QR Dashboard',
    manageSeats: 'Manage Seats',
    currentTrip: 'Current Trip',
    route: 'Route',
    vehiclePlate: 'Vehicle Plate',
    collectedAmount: 'Collected Amount',
    farePerSeat: 'Fare / Seat',
    paidSeats: 'Paid Seats',
    totalCapacity: 'Passenger Capacity',
    showPaymentQR: 'Show Payment QR',
    payWithTelebirr: 'Pay with telebirr',
    demoModeNotice: 'SIMULATION MODE: All payments & QR codes are for preview testing.',
    demoBadge: 'DEMO MODE',
    
    // Statuses
    paid: 'Paid',
    pending: 'Pending',
    unpaid: 'Unpaid',
    
    // Seat Card
    seat: 'Seat',
    tapToCollect: 'Tap to collect fare',
    tapToViewReceipt: 'Tap to view receipt',
    waitingConfirmation: 'Awaiting customer scan',
    
    // Payment Sheet
    seatPaymentTitle: 'Seat Payment',
    passengerFare: 'Passenger Fare',
    scanToPaySubtitle: 'Ask passenger to scan this QR code with their telebirr app.',
    paymentStatus: 'Payment Status',
    statusAwaiting: 'Waiting for Telebirr Confirmation',
    statusConfirmed: 'Payment Confirmed & Verified',
    statusFailed: 'Payment Failed or Rejected',
    statusExpired: 'QR Code Expired',
    statusOffline: 'Network Offline - Reconnecting...',
    simulateSuccess: 'Simulate Customer Scan & Pay',
    simulateFail: 'Simulate Failure / Timeout',
    simulateReset: 'Reset to Unpaid',
    close: 'Close',
    back: 'Back',
    
    // Receipt Modal
    receiptTitle: 'Payment Receipt',
    receiptVerifiedText: 'Confirmed by Telebirr Gateway',
    txRef: 'Transaction Ref',
    paidAt: 'Payment Time',
    amount: 'Amount',
    seatNumber: 'Seat Number',
    done: 'Done',
    
    // Seat Manager
    seatManagerTitle: 'Admin: Manage Seats',
    seatManagerSubtitle: 'Adjust passenger capacity (driver seat excluded).',
    addSeat: 'Add Passenger Seat',
    removeSeat: 'Remove Selected Seat',
    capacityLimitReached: 'Maximum capacity (24 seats) reached',
    minCapacityReached: 'Minimum 1 seat required',
    selectSeatToRemove: 'Select an unpaid seat to remove:',
    confirmRemovalTitle: 'Confirm Removal',
    confirmRemovalMsg: 'Are you sure you want to remove Seat #{num}? This action updates the vehicle layout.',
    removeAction: 'Remove',
    cancelAction: 'Cancel',
    cannotRemovePaidOrPending: 'Cannot remove Seat #{num} because it has a paid or pending payment on this trip.',
    
    // Trip Actions
    newTrip: 'New Trip',
    newTripConfirmTitle: 'Start New Trip?',
    newTripConfirmMsg: 'This will reset all seats to Unpaid for the next journey. Current trip receipts are archived.',
    unresolvedWarning: 'Warning: There is {count} pending/unpaid seat(s) on the current trip.',
    startTrip: 'Start Trip',
    configureTrip: 'Trip Settings',
    editRouteAndFare: 'Edit Route & Fare',
    saveTripSettings: 'Save Settings',
    fareInputLabel: 'Fare per seat (ETB)',
    routeInputLabel: 'Route Name',
    plateInputLabel: 'Vehicle Plate Number',
    
    // Unpaid seat picker
    selectSeatForQR: 'Select Unpaid Seat',
    noUnpaidSeats: 'All seats on this trip are paid! Great job!',
  },
  am: {
    appName: 'ታክሲፔይ',
    subtitle: 'የረዳት የክፍያ ዳሽቦርድ',
    manageSeats: 'መቀመጫዎችን አስተዳድር',
    currentTrip: 'የአሁኑ ጉዞ',
    route: 'መስመር',
    vehiclePlate: 'የሰሌዳ ቁጥር',
    collectedAmount: 'የተሰበሰበው ሂሳብ',
    farePerSeat: 'የሰው ታሪፍ',
    paidSeats: 'የተከፈሉ ወንበሮች',
    totalCapacity: 'የተሳፋሪ ወንበሮች',
    showPaymentQR: 'የክፍያ QR አሳይ',
    payWithTelebirr: 'በቴሌብር ይክፈሉ',
    demoModeNotice: 'የሙከራ ሁነታ፡ ሁሉም ክፍያዎች እና የQR ኮዶች ለሙከራ የቀረቡ ናቸው።',
    demoBadge: 'ሙከራ',
    
    // Statuses
    paid: 'ተከፍሏል',
    pending: 'በሂደት ላይ',
    unpaid: 'አልተከፈለም',
    
    // Seat Card
    seat: 'መቀመጫ',
    tapToCollect: 'ክፍያ ለመቀበል ይንኩ',
    tapToViewReceipt: 'ደረሰኝ ለማየት ይንኩ',
    waitingConfirmation: 'የተሳፋሪውን ክፍያ በመጠበቅ ላይ',
    
    // Payment Sheet
    seatPaymentTitle: 'የመቀመጫ ክፍያ',
    passengerFare: 'የመጓጓዣ ታሪፍ',
    scanToPaySubtitle: 'ተሳፋሪው በቴሌብር አፕሊኬሽን ይህንን QR እንዲያነብ ያድርጉ።',
    paymentStatus: 'የክፍያ ሁኔታ',
    statusAwaiting: 'የቴሌብር ማረጋገጫ በመጠበቅ ላይ',
    statusConfirmed: 'ክፍያው በተሳካ ሁኔታ ተረጋግጧል',
    statusFailed: 'ክፍያው አልተሳካም ወይም ተሰርዟል',
    statusExpired: 'የQR ኮዱ ጊዜ አልፎበታል',
    statusOffline: 'የኢንተርኔት ግንኙነት የለም',
    simulateSuccess: 'የደንበኛ ክፍያን ሞክር (ስኬት)',
    simulateFail: 'ክፍያ አልተሳካም ሞክር',
    simulateReset: 'እንደገና ወደ አልተከፈለ መልስ',
    close: 'ዝጋ',
    back: 'ተመለስ',
    
    // Receipt Modal
    receiptTitle: 'የክፍያ ደረሰኝ',
    receiptVerifiedText: 'በቴሌብር ክፍያ የተረጋገጠ',
    txRef: 'የግብይት ቁጥር (Ref)',
    paidAt: 'የተከፈለበት ሰዓት',
    amount: 'የተከፈለው መጠን',
    seatNumber: 'የመቀመጫ ቁጥር',
    done: 'ጨርስ',
    
    // Seat Manager
    seatManagerTitle: 'አስተዳዳሪ፡ መቀመጫዎች',
    seatManagerSubtitle: 'የተሳፋሪ ወንበሮች ብዛት ያስተካክሉ (የአሽከርካሪ ወንበር አይቆጠርም)።',
    addSeat: 'አዲስ መቀመጫ ጨምር',
    removeSeat: 'የተመረጠውን መቀመጫ ቀንስ',
    capacityLimitReached: 'ከፍተኛው መቀመጫ (24) ደርሷል',
    minCapacityReached: 'ቢያንስ 1 መቀመጫ ያስፈልጋል',
    selectSeatToRemove: 'ለመቀነስ ያልተከፈለ መቀመጫ ይምረጡ፡',
    confirmRemovalTitle: 'መቀመጫ ለመቀነስ እርግጠኛ ነዎት?',
    confirmRemovalMsg: 'መቀመጫ ቁጥር #{num} እንዲቀነስ ይፈልጋሉ?',
    removeAction: 'ቀንስ',
    cancelAction: 'ይቅር',
    cannotRemovePaidOrPending: 'መቀመጫ #{num} በዚህ ጉዞ የተከፈለበት ወይም በሂደት ላይ ያለ ክፍያ ስላለው መቀነስ አይቻልም።',
    
    // Trip Actions
    newTrip: 'አዲስ ጉዞ',
    newTripConfirmTitle: 'አዲስ ጉዞ መጀመር ይፈልጋሉ?',
    newTripConfirmMsg: 'ይህ ለቀጣዩ ጉዞ ሁሉንም መቀመጫዎች ወደ አልተከፈለም ይቀይራል። ያለፈው ጉዞ ደረሰኞች ይቀመጣሉ።',
    unresolvedWarning: 'ማስጠንቀቂያ፡ በዚህ ጉዞ ላይ {count} ያልተከፈሉ ወይም በሂደት ላይ ያሉ መቀመጫዎች አሉ።',
    startTrip: 'ጉዞ ጀምር',
    configureTrip: 'የጉዞ ቅንብሮች',
    editRouteAndFare: 'መስመር እና ታሪፍ ቀይር',
    saveTripSettings: 'አስቀምጥ',
    fareInputLabel: 'የአንድ ሰው ታሪፍ (በብር)',
    routeInputLabel: 'የመስመር ስም',
    plateInputLabel: 'የሰሌዳ ቁጥር',
    
    // Unpaid seat picker
    selectSeatForQR: 'ያልተከፈለ መቀመጫ ይምረጡ',
    noUnpaidSeats: 'በዚህ ጉዞ ሁሉም መቀመጫዎች ተከፍለዋል! እናመሰግናለን!',
  }
};
